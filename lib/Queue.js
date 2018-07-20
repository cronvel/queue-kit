/*
	Queue Kit

	Copyright (c) 2018 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var Promise = require( 'seventh' ) ;
var NextGenEvents = require( 'nextgen-events' ) ;
var List = require( 'chain-lightning' ) ;

var Job = require( './Job.js' ) ;



/*
	Options:
		concurrency `number` of concurrent jobs
		retryTimeout `number` base timeout for job retry in ms
		retryTimeoutMultiplier `number` timeout multiplier after each retry
		retryMax `number` maximum number of retry before giving up
		functions `Object` of `function`, a job may use a string instead of a function, the string is the key of this object
		hooks `Object` of `function` (hooks), where:
			removeFatalError `fn(job)` a job with a fatal error about to be removed
*/
function Queue( options = {} ) {
	this.concurrency = options.concurrency || 1 ;
	this.retryTimeout = options.retryTimeout || 0 ;
	this.retryTimeoutMultiplier = options.retryTimeoutMultiplier || 2 ;
	this.retryMax = options.retryMax || Infinity ;
	this.functions = options.functions || {} ;
	this.hooks = options.hooks || {} ;
	this.total = 0 ;
	this.inProgress = 0 ;
	this.done = 0 ;
	this.failed = 0 ;
	this.jobs = new List() ;

	this.defineStates( 'stopped' , 'started' , 'idling' , 'running' ) ;
	this.emit( 'stopped' ) ;
}

Queue.prototype = Object.create( NextGenEvents.prototype ) ;
Queue.prototype.constructor = Queue ;

module.exports = Queue ;



Queue.prototype.addJob = function addJob( job , data , tasks ) {
	if ( ! ( job instanceof Job ) ) {
		job = new Job( this , job , data , tasks ) ;
	}

	this.total ++ ;
	this.jobs.push( job ) ;

	if ( ! this.hasState( 'stopped' ) ) {
		this.next() ;
	}
} ;



Queue.prototype.addFunctions = function addFunctions( functions ) { Object.assign( this.functions , functions ) ; } ;
Queue.prototype.setConcurrency = function setConcurrency( concurrency ) { this.concurrency = concurrency ; } ;



Queue.prototype.start = function start() {
	if ( ! this.hasState( 'stopped' ) ) { return ; }
	this.emit( 'started' ) ;
	this.next() ;
} ;



Queue.prototype.stop = function stop() {
	if ( this.hasState( 'stopped' ) ) { return ; }
	this.emit( 'stopped' ) ;
} ;



Queue.prototype.next = function next() {
	if ( this.hasState( 'stopped' ) || this.inProgress >= this.concurrency ) { return ; }

	// Now that jobs are moved to tail immediately, this slot is actually this.jobs.head, if there are pending jobs anymore
	var slot = this.jobs.findSlot( j => j.status === Job.PENDING ) ;

	if ( ! slot ) {
		if ( this.inProgress <= 0 ) {
			this.emit( 'idling' ) ;
		}
		return ;
	}

	// Move this slot immediately to tail
	this.jobs.moveToTail( slot ) ;

	var job = this.jobs.get( slot ) ;

	this.inProgress ++ ;
	this.emit( 'running' ) ;

	job.run()
	.then(
		() => {
			this.inProgress -- ;
			this.done ++ ;
			this.jobs.removeSlot( slot ) ;
			this.progress( true ) ;
			this.next() ;
		} ,
		error => {
			this.inProgress -- ;

			var retryTimeout = this.retryTimeout * Math.pow( this.retryTimeoutMultiplier , job.failCount - 1 ) ;
			//console.log( "retryTimeout:" , retryTimeout ) ;
			setTimeout( () => this.retryJob( job , slot ) , retryTimeout ) ;

			// This cause hard to track error, because it is usually 'detached' from main sync flow.
			// So we disabled it.
			//this.emit( 'error' , error ) ;

			this.progress() ;
			this.next() ;
		}
	) ;

	this.next() ;
} ;



Queue.prototype.progress = function progress( justDoneOneJob ) {
	this.emit( 'progress' , this.done , this.failed , this.inProgress , this.total - this.done - -this.failed - this.inProgress ) ;
} ;



Queue.prototype.retryAll = function retryAll() {
	this.jobs.forEach( ( job , slot ) => {
		var retryTimeout = this.retryTimeout * Math.pow( this.retryTimeoutMultiplier , job.failCount - 1 ) ;
		//console.log( "retryTimeout:" , retryTimeout ) ;
		setTimeout( () => this.retryJob( job , slot ) , retryTimeout ) ;
	} ) ;
} ;



Queue.prototype.retryJob = function retryJob( job , slot ) {
	if ( job.status !== Job.ERROR ) { return ; }

	if ( job.failCount > this.retryMax ) { job.fatal = true ; }

	if ( job.fatal ) {
		if ( this.hooks.removeFatalError ) { this.hooks.removeFatalError( job ) ; }
		this.jobs.removeSlot( slot ) ;
		return false ;
	}

	job.status = Job.PENDING ;
	job.promise = null ;
	job.error = null ;

	this.next() ;
} ;



Queue.prototype.stringify = function stringify() {
	return JSON.stringify(
		this ,
		( key , value ) => {
			if ( key === 'functions' ) { return ; }
			if ( value instanceof List ) { return [ ... value ] ; }
			if ( value instanceof Job ) { return value.toObject() ; }
			return value ;
		} ,
		'    '
	) ;
} ;



// Parse/restore a queue
Queue.parse = function parse( str , options ) {
	var object = JSON.parse( str ) ,
		queue = new Queue( options ) ;

	object.jobs = List.from( object.jobs.map( job => Job.restoreFromObject( queue , job ) ) ) ;

	Object.assign( queue , object ) ;

	// in-progress job are now pending
	queue.inProgress = 0 ;

	return queue ;
} ;


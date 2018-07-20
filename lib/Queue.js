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



function Queue( options = {} ) {
	this.concurrency = options.concurrency || 1 ;
	this.total = 0 ;
	this.inProgress = 0 ;
	this.done = 0 ;
	this.functions = options.functions || {} ;
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

	var slot = this.jobs.findSlot( j => j.status === Job.PENDING ) ;

	if ( ! slot ) {
		if ( this.inProgress <= 0 ) {
			this.emit( 'idling' ) ;
		}
		return ;
	}
	
	var job = this.jobs.get( slot ) ;

	this.inProgress ++ ;
	this.emit( 'running' ) ;

	job.run()
	.then(
		() => {
			this.inProgress -- ;
			this.done ++ ;
			this.progress( true ) ;
			this.jobs.removeSlot( slot ) ;
			this.next() ;
		} ,
		error => {
			this.inProgress -- ;

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
	this.emit( 'progress' , this.done , this.inProgress , this.total - this.done - this.inProgress ) ;
} ;



Queue.prototype.retry = function retry() {
	var found = false ;

	this.jobs.forEach( job => {
		if ( job.status === Job.ERROR && ! job.fatal ) {
			job.status = Job.PENDING ;
			job.promise = null ;
			job.error = null ;
			found = true ;
		}
	} ) ;

	if ( found ) { this.next() ; }
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


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

var Job = require( './Job.js' ) ;



function Queue( options = {} ) {
	this.concurrency = options.concurrency || 1 ;
	this.inProgress = 0 ;
	this.done = 0 ;
	this.functions = options.functions || {} ;
	this.jobs = [] ;

	this.defineStates( 'stopped' , 'started' , 'idling' , 'running' ) ;
	this.emit( 'stopped' ) ;
}

Queue.prototype = Object.create( NextGenEvents.prototype ) ;
Queue.prototype.constructor = Queue ;

module.exports = Queue ;



Queue.prototype.add =
Queue.prototype.addJob = function addJob( job , data ) {
	if ( typeof job === 'function' ) {
		job = new Job( job , data ) ;
	}

	this.jobs.push( job ) ;

	if ( ! this.hasState( 'stopped' ) ) {
		this.next() ;
	}
} ;



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

	var job = this.jobs.find( j => j.status === Job.PENDING ) ;

	if ( ! job ) {
		if ( this.inProgress <= 0 ) {
			this.emit( 'idling' ) ;
		}
		return ;
	}

	this.inProgress ++ ;
	this.emit( 'running' ) ;

	job.run( this )
	.then(
		() => {
			this.inProgress -- ;
			this.done ++ ;
			this.next() ;
		} ,
		error => {
			this.inProgress -- ;
			this.emit( 'error' , error ) ;
			this.next() ;
		}
	) ;

	this.next() ;
} ;



Queue.prototype.stringify = function stringify() {
	return JSON.stringify(
		this ,
		( key , value ) => {
			if ( key === 'functions' ) { return ; }
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

	object.jobs = object.jobs.map( job => Job.fromObject( job ) ) ;

	Object.assign( queue , object ) ;

	return queue ;
} ;


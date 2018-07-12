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
	this.jobs = [] ;
	this.runningJobs = 0 ;

	this.defineStates( 'stopped' , 'started' , 'idling' , 'running' ) ;
	this.emit( 'stopped' ) ;
}

Queue.prototype = Object.create( NextGenEvents.prototype ) ;
Queue.prototype.constructor = Queue ;
Queue.Job = Job ;

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
	if ( this.hasState( 'stopped' ) || this.runningJobs >= this.concurrency ) { return ; }

	var job = this.jobs.find( j => j.status === Job.PENDING ) ;

	if ( ! job ) {
		if ( this.runningJobs <= 0 ) {
			this.emit( 'idling' ) ;
		}
		return ;
	}

	this.runningJobs ++ ;

	job.run()
	.then(
		() => {
			this.runningJobs -- ;
			this.next() ;
		} ,
		error => {
			this.runningJobs -- ;
			this.emit( 'error' , error ) ;
			this.next() ;
		}
	) ;

	this.next() ;
} ;


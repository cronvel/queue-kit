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



function Job( fn , data ) {
	this.fn = fn ;
	this.data = data ;
	this.status = Job.PENDING ;
	this.promise = null ;
	this.tasks = {} ;
	this.progress = null ;
	this.value = null ;
	this.error = null ;
	this.failCount = 0 ;
}

module.exports = Job ;



Job.PENDING = 0 ;
Job.RUNNING = 1 ;
Job.DONE = 2 ;
Job.ERROR = -1 ;



Job.prototype.run = function run( queue ) {
	var fn = typeof this.fn === 'string' ? queue.functions[ this.fn ] : this.fn ;

	if ( typeof fn !== 'function' ) { return Promise.reject( new Error( "Cannot find a function for: " + this.fn ) ) ; }

	this.status = Job.RUNNING ;
	queue.emit( 'jobStart' , this ) ;

	// Ensure that a promise is returned
	this.promise = Promise.resolve( fn( this.data , this ) ) ;

	this.promise.then(
		value => {
			this.status = Job.DONE ;
			this.value = value ;
			queue.emit( 'jobDone' , this ) ;
		} ,
		error => {
			this.status = Job.ERROR ;
			this.error = error ;
			this.failCount ++ ;
			queue.emit( 'jobError' , this ) ;
		}
	) ;

	return this.promise ;
} ;



Job.prototype.toObject = function toObject() {
	var object = Object.assign( {} , this ) ;
	delete object.promise ;
	return object ;
} ;



Job.fromObject = function fromObject( object ) {
	var job = new Job() ;
	Object.assign( job , object ) ;
	return job ;
} ;


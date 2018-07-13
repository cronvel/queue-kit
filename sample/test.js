#!/usr/bin/env node

"use strict" ;

var Promise = require( 'seventh' ) ;
var qKit = require( '..' ) ;
var Queue = qKit.Queue ;
var Job = qKit.Job ;


var queue = new Queue( {
	concurrency: 3 ,
//	cleanUpInterval: 5000
} ) ;

function jobFn( data ) {
	return Promise.resolveTimeout( data.timeout ) ;
}

function dang( data ) {
	return Promise.rejectTimeout( data.timeout , new Error( "Dang!" ) ) ;
}

var count = 0 ;

queue.addJob( jobFn , { id: count ++ , timeout: 300 } ) ;
queue.addJob( dang , { id: count ++ , timeout: 10 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 3000 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 300 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 300 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 3000 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 5000 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 500 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 2000 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 300 } ) ;
queue.addJob( jobFn , { id: count ++ , timeout: 300 } ) ;

queue.on( 'stopped' , () => console.log( "Queue is stopped" ) ) ;
queue.on( 'started' , () => console.log( "Queue is started" ) ) ;
queue.on( 'idling' , () => console.log( "Queue is idling" ) ) ;
queue.on( 'running' , () => console.log( "Queue is running" ) ) ;
queue.on( 'jobStart' , job => console.log( "Starting job #" + job.data.id + " (" + job.data.timeout + "ms)" ) ) ;
queue.on( 'jobDone' , job => console.log( "Done job #" + job.data.id + " (" + job.data.timeout + "ms)" ) ) ;
queue.on( 'jobError' , job => console.log( "ERROR in job #" + job.data.id + " (" + job.data.timeout + "ms)" , job.error ) ) ;
queue.on( 'progress' , ( jobDone , jobInProgress , jobRemaining ) => console.log( "Progress" , jobDone , jobInProgress , jobRemaining ) ) ;

queue.start() ;

/*
setInterval( () => {
	queue.addJob( jobFn , { id: count ++ , timeout: 300 } ) ;
	queue.addJob( jobFn , { id: count ++ , timeout: 3000 } ) ;
} , 500 ) ;
//*/

setTimeout( () => queue.stop() , 1000 ) ;
setTimeout( () => queue.start() , 10000 ) ;

setTimeout( () => {
	queue.addJob( jobFn , { id: count ++ , timeout: 2700 } ) ;
	queue.addJob( jobFn , { id: count ++ , timeout: 700 } ) ;
} , 8000 ) ;

setTimeout( () => {
	queue.addJob( jobFn , { id: count ++ , timeout: 2800 } ) ;
	queue.addJob( jobFn , { id: count ++ , timeout: 800 } ) ;
} , 15000 ) ;


/*
var stringified = queue.stringify() ;
console.log( "stringified:" , stringified ) ;
var parsed = Queue.parse( stringified ) ;
console.log( "parsed" , parsed ) ;
*/


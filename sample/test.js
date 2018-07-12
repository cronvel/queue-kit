#!/usr/bin/env node

"use strict" ;

var Promise = require( 'seventh' ) ;
var Queue = require( '..' ) ;
var Job = Queue.Job ;


var queue = new Queue( { concurrency: 2 } ) ;

function jobFn( data ) {
	console.log( "Starting job #" + data.id ) ;
	return Promise.resolveTimeout( data.timeout ).then( () => {
		console.log( "Done job #" + data.id ) ;
	} ) ;
}

var count = 0 ;

queue.add( new Job( jobFn , { id: count ++ , timeout: 300 } ) ) ;
queue.add( new Job( jobFn , { id: count ++ , timeout: 3000 } ) ) ;
queue.add( new Job( jobFn , { id: count ++ , timeout: 300 } ) ) ;
queue.add( new Job( jobFn , { id: count ++ , timeout: 300 } ) ) ;
queue.add( new Job( jobFn , { id: count ++ , timeout: 3000 } ) ) ;
queue.add( new Job( jobFn , { id: count ++ , timeout: 300 } ) ) ;
queue.add( new Job( jobFn , { id: count ++ , timeout: 300 } ) ) ;

queue.start() ;


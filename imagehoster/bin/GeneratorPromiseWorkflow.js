/** @see https://www.bennadel.com/blog/3123-using-es6-generators-and-yield-to-implement-asynchronous-workflows-in-javascript.htm */
function createGeneratorPromiseWorkflow( generatorFunction ) {
    return( iterationProxy );
    function iterationProxy() {

        // When we call the generator function, the body of the generator is NOT
        // executed. Instead, an iterator is returned that can iterate over the
        // segments of the generator body, delineated by yield statements.
        var iterator = generatorFunction.apply( this, arguments );

        // function* () {
        // var a = yield( getA() ); // (1)
        // var b = yield( getB() ); // (2)
        // return( [ a, b ] ); // (3)
        // }

        // When we initiate the iteration, we need to catch any errors that may occur
        // before the first "yield". Such an error will short-circuit the process and
        // result in a rejected promise.
        try {

            // When we call .next() here, we are kicking off the iteration of the
            // generator produced by our generator function. The function will start
            // executing and run until it hits the first "yield" statement (1), which
            // will return, as its result, the value supplied to the "yield" statement.
            // The .next() result will look like this:
            // --
            // {
            // done: false,
            // value: getA() // Passed to "yield"; may or may not be a Promise.
            // }
            // --
            // We then pipe this result back into the next iteration of the generator.
            return( pipeResultBackIntoGenerator( iterator.next() ) );

        } catch ( error ) {

            return( Promise.reject( error ) );

        }


        // I take the given iterator result, extract the value, and pipe it back into
        // the next iteration. Returns a promise.
        // --
        // NOTE: This function calls itself recursively, building up a promise-chain
        // that represents each generator iteration step.
        function pipeResultBackIntoGenerator( iteratorResult ) {

            if ( iteratorResult.done ) {

                // If the generator is done iterating through its function body, we can
                // return one final promise of the value that was returned from the
                // generator function (3). The iteratorResult would look like this:
                // --
                // {
                // done: true,
                // value: [ a, b ]
                // }
                // --
                // So, our return() statement here really is doing this:
                // --
                // return( Promise.resolve( [ a, b ] ) ); // (3)
                return( Promise.resolve( iteratorResult.value ) );

            }

            // If the generator is NOT DONE iterating through its function body, we need
            // to bridge the gap between the yields. We can do this by turning each step
            // into a promise that can build on itself recursively.
            var intermediaryPromise = Promise
                // Normalize the value returned by the iterator in order to ensure that
                // its a promise (so that we know it is "thenable").
                .resolve( iteratorResult.value )
                .then(
                    function handleResolve( value ) {

                        // Once the promise has returned with a value, we need to
                        // pipe that value back into the generator function, which is
                        // currently paused on a "yield" statement. When we call
                        // .next( value ) here, we are replacing the currently-paused
                        // "yield" with the given "value", and resuming the iteration.
                        // Essentially, this pre-yielded statement:
                        // --
                        // var a = yield( getA() ); // (1)
                        // --
                        // ... becomes this after we call .next( value ):
                        // --
                        // var a = value; // (1)
                        // --
                        // At this point, the generator function continues its execution
                        // until the next yield; or until it hits the a return (implicit
                        // or explicit).
                        return( pipeResultBackIntoGenerator( iterator.next( value ) ) );

                        // CAUTION: If iterator.next() throws an error that is not
                        // handled by the generator, it will cause an exception inside
                        // this resolution handler, which will cause the promise to be
                        // rejected.

                    },
                    function handleReject( reason ) {

                        // If the promise value from the previous step results in a
                        // rejection, we need to pipe that rejection back into the
                        // generator where the generator may or may not be able to handle
                        // it gracefully. When we call iterator.throw(), we resume the
                        // generator function with an error. If the generator function
                        // doesn't catch this error, it will bubble up right here and
                        // cause an error inside the of handleReject() function (which
                        // will lead to a rejected promise). However, if the generator
                        // function catches the error and returns a value, that value
                        // will be wrapped in an iterator result and piped back into the
                        // generator.
                        return( pipeResultBackIntoGenerator( iterator.throw( reason ) ) );

                    }
                )
            ;
            return( intermediaryPromise );
        }
    }
}
module.exports = createGeneratorPromiseWorkflow
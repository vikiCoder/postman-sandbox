var FUNCTION = 'function',

    decorateEventArgsWithError = function (e, eventArgs) {
        if (e !== undefined && e !== null) { // eslint-disable-line lodash/prefer-is-nil
            eventArgs.error = e;
            eventArgs.passed = false;
        }
        return eventArgs;
    };

module.exports = function (pm, timers, onAssertion) {
    var assertions = [],
        assertionIndex = 0,

        getAssertionObject = function (name, skipped, index) {
            return {
                name: String(name),
                skipped: Boolean(skipped),
                passed: true,
                error: null,
                index: Number(index) // increment the assertion counter (do it before asserting)
            };
        },

        currentAssertion,
        process,
        processNext;

    /**
     * @param  {String} name
     * @param  {Function} assert
     * @chainable
     */
    pm.test = function (name, assert) {
        assertions.push({
            name: name,
            fn: assert,
            index: assertionIndex++
        });

        process(assertions.shift());
        return pm;
    };

    pm.test.skip = function (name) {
        assertions.push({
            name: name,
            skipped: true,
            index: assertionIndex++
        });

        process(assertions.shift());
        return pm;
    };

    pm.test.clear = function () {
        assertions.length = 0;
    };

    // @todo ensure that there is a timeout
    processNext = function (eventArgs, previousIsComplete) {
        if (previousIsComplete) {
            onAssertion(eventArgs);
        }
        else if (currentAssertion) {
            return;
        }

        process((currentAssertion = assertions.shift()));
    };

    process = function (assertion) {
        if (!assertion) {
            return;
        }

        var eventArgs = getAssertionObject(assertion.name, assertion.skipped, assertion.index),
            isAsync = eventArgs.async = (assertion.fn && (assertion.fn.length > 0)),
            assert = assertion.fn, // we hold it here to ensure it is not scoped to assertion obj
            timerId = null;

        // we bail out early if skipped or missing assertion function
        if (typeof assertion.fn !== FUNCTION || assertion.skipped) {
            return processNext(eventArgs, true);
        }

        // let's isolate syncronous assertion be done with. async ones have additional checks and breaking logic
        // in two blocks here makes flow less confusing
        if (!isAsync) {
            try { assert(); }
            catch (err) { decorateEventArgsWithError(err, eventArgs); }
            return processNext(eventArgs, true);
        }

        // at this point assertion is expected to be async, so we setup an event that performs the routines that
        // are required to declare completion of the assertion
        timerId = timers.setEvent(function (err) {
            decorateEventArgsWithError(err, eventArgs);
            return processNext(eventArgs, true);
        });

        try {
            assert(function (err) { // this is the `done` callback received by .test asserter.
                timers.clearEvent(timerId, err);
            });
        }
        // in case of syncronous error, it should halt even if the test is async
        catch (err) {
            timers.clearEvent(timerId, err);
        }
    };
};

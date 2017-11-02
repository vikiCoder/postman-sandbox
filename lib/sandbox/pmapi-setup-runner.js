var FUNCTION = 'function',

    decorateEventArgsWithError = function (e, eventArgs) {
        if (e !== undefined && e !== null) { // eslint-disable-line lodash/prefer-is-nil
            eventArgs.error = e;
            eventArgs.passed = false;
        }
        return eventArgs;
    };

module.exports = function (pm, timers, onAssertion) {
    var assertionIndex = 0,
        getAssertionObject = function (name, skipped) {
            return {
                name: String(name),
                skipped: Boolean(skipped),
                passed: true,
                error: null,
                index: assertionIndex++ // increment the assertion counter (do it before asserting)
            };
        };

    /**
     * @param  {String} name
     * @param  {Function} assert
     * @chainable
     */
    pm.test = function (name, assert) {
        var eventArgs = getAssertionObject(name, false),
            isAsync = eventArgs.async = (assert.length > 0),
            timerId = null;

        if (typeof assert !== FUNCTION) {
            return pm;
        }

        // let's isolate syncronous assertion be done with. async ones have additional checks and breaking logic
        // in two blocks here makes flow less confusing
        if (!isAsync) {
            try { assert(); }
            catch (err) { decorateEventArgsWithError(err, eventArgs); }

            onAssertion(eventArgs);
            return pm;

        }

        // at this point assertion is expected to be async, so we setup an event that performs the routines that
        // are required to declare completion of the assertion
        timerId = timers.setEvent(function (err) {
            decorateEventArgsWithError(err, eventArgs);
            onAssertion(eventArgs);
        });

        try {
            assert(function (err) { // this is the `done` callback received by .test asserter.
                timers.clearEvent(timerId, err);
            });
        }
        // in case of syncronous error, it should halt even if the test is async
        catch (err) {
            timers.clearEvent(timerId, err);
            return pm;
        }

        return pm;
    };

    pm.test.skip = function (name) {
        // trigger the assertion events with skips
        onAssertion(getAssertionObject(name, true));
        return pm; // chainable
    };
};

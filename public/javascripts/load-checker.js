
//var LoadChecker = new Object;
var LoadChecker = {};

/***
 * Setup up constants and configuration defaults
 * TODO: Setup a configuration object to allow the defaults to be changed
 * TODO: Parameterize configuration based on speed of client and remote site
 */

LoadChecker._domMutationOrNodeCountIntervalCheck = null;
LoadChecker._CHECK_INTERVAL_MS = 500;

LoadChecker._lastKnownNodeCountForMutationEvent = 0;
LoadChecker._mutationsCount = 0;
LoadChecker._lastKnownNodeCountForNodeCountCheck = 0;

LoadChecker._EXIT_REGARDLESS_AFTER_MAX_INTERVALS = 20; // if we go this long (10s) without a steady state, consider it an exception, investigate
LoadChecker._intervalCount = 0;
LoadChecker._steadyStateIntervals = 0;
LoadChecker._READY_AFTER_N_STEADY_STATE_INTERVALS = 5; // expect steady state after (2.5s)


LoadChecker.EventUtil = {};

LoadChecker.EventUtil.addEventHandler = function (oTarget, sEventType, fnHandler) {
    if (oTarget.addEventListener) {
        oTarget.addEventListener(sEventType, fnHandler, false);
    } else if (oTarget.attachEvent) {
        oTarget.attachEvent("on" + sEventType, fnHandler);
    } else {
        oTarget["on" + sEventType] = fnHandler;
    }
};

LoadChecker.EventUtil.removeEventHandler = function (oTarget, sEventType, fnHandler) {
    if (oTarget.removeEventListener) {
        oTarget.removeEventListener(sEventType, fnHandler, false);
    } else if (oTarget.detachEvent) {
        oTarget.detachEvent("on" + sEventType, fnHandler);
    } else {
        oTarget["on" + sEventType] = null;
    }
};

// Recursively count the nodes in the DOM
// TODO: Look for a more efficient way to do this
LoadChecker._countElements = function (children) {
    var count = 0;

    //console.log("counting children:",children.length);

    // snap the count in (size) to prevent infinite loop for every changing DOM
    for (var i = 0, size = children.length; i < size; i++) {
        if (children[i].nodeType === document.ELEMENT_NODE) {
            count++;
            //console.log(count,children[i]);
            count += LoadChecker._countElements(children[i].childNodes);
        }
    }
    return count;
};

// see if DOM node count has changed
LoadChecker._nodeCountChangeObserver = function () {
    //LoadChecker._intervalCount++;
    var currentNodeCount = LoadChecker._countElements(document.childNodes);
    var isNodeListChanging = LoadChecker._lastKnownNodeCountForNodeCountCheck !== currentNodeCount;
    if (isNodeListChanging) {
        LoadChecker._lastKnownNodeCountForNodeCountCheck = currentNodeCount;
        console.log("LoadChecker: INFO: DOM node count changing; current:", currentNodeCount, " last:", LoadChecker._lastKnownNodeCountForNodeCountCheck);
    } else {
        LoadChecker._steadyStateIntervals++;
        console.log("LoadChecker: INFO: DOM node count is ", currentNodeCount, ". At steady state for " + LoadChecker._steadyStateIntervals + " intervals");
    }
};



// see if DOM has had mutations since last check
LoadChecker._domMutationsCountObserver = function () {
    //LoadChecker._intervalCount++;
    var isDomChanging = LoadChecker._mutationsCount > 0;

    if (isDomChanging) {
        console.log("LoadChecker: INFO: On iteration:(",LoadChecker._intervalCount,") DOM is changing, ", LoadChecker._mutationsCount, " since last reset, resetting steadyStateCount and mutationCount to ZERO");
        LoadChecker._mutationsCount = 0;
        LoadChecker._steadyStateIntervals = 0;
    } else {
        LoadChecker._steadyStateIntervals++;
        console.log("LoadChecker: INFO: On iteration:(",LoadChecker._intervalCount,") DOM has had ZERO mutations for the last " + LoadChecker._steadyStateIntervals + " intervals");
    }
};



/***
 *** Add some support for checking if the DOM has mutated
 ***/




//LoadChecker._setupNodeCountChangeObserver = function() {
//    window.setTimeout(LoadChecker._nodeCountChangeObserver, LoadChecker._CHECK_INTERVAL_MS);
//}


/***
 * Try to use the MutationObserver to monitor changes to the DOM.
 * @returns {boolean} - true if setup was successful, false otherwise
 * @private
 */
LoadChecker._setupMutationObserverIfPossible = function() {
    try {
        MutationObserver = window.MutationObserver || window.WebKitMutationObserver ;
        var mutationObserver = new MutationObserver(function (mutations, observer) {
            console.log(mutations, observer);
            var currentNodeCount = LoadChecker._countElements(document.childNodes);
            var isNodeListCountChanging = LoadChecker._lastKnownNodeCountForMutationEvent !== currentNodeCount;
            LoadChecker._lastKnownNodeCountForMutationEvent = currentNodeCount;

            // TODO: determine the best way to examine the mutation event to determine if nodes were added
            // Until such time as there is a better implementation for determining if the DOM structure
            // was changed by the mutation event, assume that node count has to change.
            // This crude check will prevent an page is loaded timeout for pages that update content in real-time.
            if (isNodeListCountChanging) {
                LoadChecker._mutationsCount++;
            }
            console.log("Current node count:",currentNodeCount," Last node count:",
                LoadChecker._lastKnownNodeCountForMutationEvent," Count is changing:", isNodeListCountChanging,
                " Mutations Count:",LoadChecker._mutationsCount);

        });

        if (mutationObserver) {
            mutationObserver.observe(document.documentElement, {
                attributes: true,
                characterData: true,
                childList: true,
                subtree: true,
                attributeOldValue: true,
                characterDataOldValue: true
            });
            console.log("LoadChecker: INFO: Successfully setup MutationObserver for DOM change notification");
        }
    } catch (ex) {
        console.log("LoadChecker: WARNING: Cannot use MutationObserver, defaulting to node count only",ex);
        return false;
    }

    return true;
};

// setup page load checks
LoadChecker._setupLoadChecker = function () {
    try {
        LoadChecker._steadyStateIntervals = 0;
        LoadChecker._mutationsCount = 0;
        LoadChecker._intervalCount = 0;
        if (LoadChecker._setupMutationObserverIfPossible()) {
            LoadChecker._domMutationOrNodeCountIntervalCheck = setInterval(LoadChecker._domMutationsCountObserver, LoadChecker._CHECK_INTERVAL_MS);
            console.log("LoadChecker: INFO: Using MutationObserver for DOM change checking");
        } else {
            LoadChecker._domMutationOrNodeCountIntervalCheck = setInterval(LoadChecker._nodeCountChangeObserver, LoadChecker._CHECK_INTERVAL_MS);
            console.log("LoadChecker: INFO: Using node count checks for DOM change checking");
        }
    } catch (ex) {
        var errorMsg = "LoadChecker: ERROR: failed to setup load checker! cannot execute callback, please report error: " + ex;
        throw(errorMsg);
    }
};

// clean-up as needed after page loaded or timeout or other exception
LoadChecker._cleanupLoadChecker = function () {
    try {
        clearInterval(LoadChecker._domMutationOrNodeCountIntervalCheck);
    }
    catch (ex) {
        var errorMsg = "LoadChecker: ERROR: clean up failed!:" + ex;
        throw(errorMsg);
    }
};

// utility to get seconds for number of intervals
LoadChecker._getSecondsForIntervals = function (intervalCount) {
    return intervalCount * LoadChecker._CHECK_INTERVAL_MS / 1000.0;
};

/***
 * If we detect that the page has reached a steady state (no new elements added to DOM)
 * after a specific time period, we assume the page is loaded. If we have exceeded the
 * maximum allotted time to reach a steady state we will throw an error suggesting the
 * user call LoadChecker.callWhenReadyToGo again or reviewing the implementation.
 *
 * For this implementation to be of production quality, it would require the ability to
 * change the configuration and ideally some intelligent analysis of the connection speed
 * for the browser and response time of the web site. Both would need to be considered
 * when determining the appropriate time outs for reaching or failing to reach a steady state.
 *
 * @returns {boolean}
 * @private
 */
LoadChecker._isPageLoaded = function () {
    if (LoadChecker._steadyStateIntervals >= LoadChecker._READY_AFTER_N_STEADY_STATE_INTERVALS) {
        var elapasedTimeSeconds = LoadChecker._getSecondsForIntervals(LoadChecker._steadyStateIntervals);
        console.log("LoadChecker: INFO: *Page Loaded*: No changes detected after ",elapasedTimeSeconds," seconds");
        return true; // we reached steady state and believe page is loaded
    } else {
        LoadChecker._intervalCount++;
        if (LoadChecker._intervalCount > LoadChecker._EXIT_REGARDLESS_AFTER_MAX_INTERVALS) {
            elapasedTimeSeconds = LoadChecker._getSecondsForIntervals(LoadChecker._intervalCount);
            var errorMsg = "LoadChecker: ERROR: No Steady State timeout reached after " + elapasedTimeSeconds + " seconds, review implementation of LoadChecker or call again!";
            console.log(errorMsg);
            throw(errorMsg); // we aren't going to wait anymore - it's been too long something's not right
        }
    }
    return false; // page is not loaded
};


/***
 * Check if page is loaded at timed intervals.
 * @throws error if page load checks exceed defined maximums
 * @private
 */
LoadChecker._executeCallbackAfterPageIsLoaded = function() {

    try {
        if (LoadChecker._isPageLoaded()) {
            try {
                LoadChecker._user_callback();
                console.log("LoadChecker: INFO: executed user callback:" + callback);
            } catch (ex) {
                // TODO: decide if exception should be rethrown or if we fail with only a log message?
                console.log("LoadChecker: ERROR: Could not execute callback, exception: ", ex, " callback: ", callback);
            } finally {
                console.log("LoadChecker: INFO: cleaning up load checking interval checks");
                LoadChecker._cleanupLoadChecker();
            }
        } else {
            //setTimeout(LoadChecker._isPageLoaded, LoadChecker._CHECK_INTERVAL_MS);
            setTimeout(LoadChecker._executeCallbackAfterPageIsLoaded, LoadChecker._CHECK_INTERVAL_MS);
        }
    } catch (ex) {
        console.log("LoadChecker: INFO: cleaning up load checking interval checks after exception!:",ex);
        LoadChecker._cleanupLoadChecker();
        throw(ex); // rethrow this exception to caller to make them aware that page load state is indeterminant
    }
};

LoadChecker._validateConfiguration = function() {
    if (LoadChecker._READY_AFTER_N_STEADY_STATE_INTERVALS >= LoadChecker._EXIT_REGARDLESS_AFTER_MAX_INTERVALS) {
        var errorMsg = "LoadChecker: ERROR: Configuration Error LoadChecker._READY_AFTER_N_STEADY_STATE_INTERVALS("+LoadChecker._READY_AFTER_N_STEADY_STATE_INTERVALS+
            ") >= LoadChecker._EXIT_REGARDLESS_AFTER_MAX_INTERVALS("+LoadChecker._EXIT_REGARDLESS_AFTER_MAX_INTERVALS+")";
        console.log(errorMsg);
        throw(errorMsg);
    }
};

/***
 * Continuously check if page is loaded and execute the supplied call back when it is.
 * To prevent infinite waits, fail with exception after predetermine number of checks
 * (see configuration variables at top of file).
 * @param callback
 * @throws error message when wait time exceeds LoadChecker._EXIT_REGARDLESS_AFTER_MAX_INTERVALS * LoadChecker._CHECK_INTERVAL_MS / 1000.0
 */
LoadChecker.callWhenReadyToGo = function (callback)
{
    LoadChecker._validateConfiguration();
    LoadChecker._setupLoadChecker();
    LoadChecker._user_callback = callback;
    LoadChecker._executeCallbackAfterPageIsLoaded();
};


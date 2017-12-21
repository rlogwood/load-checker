# load-checker
Attempt to check if a web page is fully loaded, including async changes and execute a callback


Here's an example Express JS Index Page:
~~~~
extends layout

block content
  h1= title
  p Welcome to #{title}
  script(language="javascript",src='/javascripts/load-checker.js')

  script.
    alert("did we get to script. tag?")
    var callback = function() {alert("we made it dog! you loaded :)");};
    var loadChecker = new LoadChecker();
    loadChecker.callWhenReadyToGo(callback);
    try {
        loadChecker.callWhenReadyToGo(function () {
            alert("did we mess it up?")
        })
    } catch (ex) {
        console.log("Error expected on reuse of object!");
    }


    var loadChecker2 = new LoadChecker();
    loadChecker2.callWhenReadyToGo(function(){alert("do i work twice dude?")});
~~~~

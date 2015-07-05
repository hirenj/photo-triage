'use strict';

// Declare app level module which depends on views, and components
angular.module('myApp', [
  'ngRoute',
  'myApp.view1',
  'myApp.version',
  'ngShortcut',
  'ngTouch'
]).
config(['$routeProvider', '$locationProvider', function($routeProvider,$locationProvider) {
  $locationProvider.html5Mode(true);
  $routeProvider.otherwise({redirectTo: '/'});
}]);

// prevent vertical bouncy scroll on mobile devices
document.addEventListener("touchmove", function(event){
    event.preventDefault();
});

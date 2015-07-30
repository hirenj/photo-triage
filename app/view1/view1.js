'use strict';

angular.module('myApp.view1', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/dir/:folder/', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', ['$scope', '$http', '$routeParams', function($scope, $http, $routeParams) {
    $scope.currentPhoto = 0;
    $scope.photos = [];
    var localdir = $routeParams.folder;
    // Retrieve photo info and ratings from the server.
    $http.get('/dir/'+localdir+'/photos.json').success(function(data) {
        $scope.photos = data;
        if ($scope.socket) {
            $scope.socket.send( JSON.stringify({'image' : $scope.getPhotoURL($scope.currentPhoto) }) );
        }
    });

    if ( ! $scope.socket ) {
        var socket = new WebSocket("ws://"+window.location.hostname+":8080/");
        socket.onopen = function() {
            $scope.socket = socket;
            $scope.socket.send( JSON.stringify({'image' : $scope.getPhotoURL($scope.currentPhoto) }) );
        };
    }


    // Function to get the photo URL for a given index
    $scope.getPhotoURL = function(num) {
        if ($scope.photos.length > 0) {
            var n = num % $scope.photos.length;
            return '/dir/'+localdir+'/images/h:' + 800 + '/' + $scope.photos[n].fname;
        }
    };

    // Function to get the rating of the current photo
    $scope.currentRating = function() {
        return $scope.photos[$scope.currentPhoto].rating;
    };

    $scope.isDeleted = function() {
        if ($scope.photos.length > 0) {
            return $scope.photos[$scope.currentPhoto].rating < 0 ? 'sign' : 'circle';
        }
    };

    // Return an array of (unique) space-separated CSS classes
    // for building the glyphicon stars
    $scope.getStars = function() {
        if ($scope.photos.length > 0) {
            var stars = [];
            for (var s=0; s<3; s++) {
                if (s < $scope.currentRating()) {
                    stars.push("star star"+s);  // duplicates not allowed in a repeater
                } else {
                    stars.push("star-empty star"+s);
                }
            }
            return stars;
        }
    };

    // Function to set rating of current photo.
    // If called with rating equal to that of current photo, set rating to zero.
    $scope.rate = function(rating) {
        var newRating = 0;
        if (rating != $scope.currentRating()) {
            newRating = rating;
        }
        
        // POST rating back to the server.
        var data = { index: $scope.currentPhoto, rating: newRating };
        $http.post('/dir/'+localdir+'/rate', data).success(function() {
            $scope.photos[$scope.currentPhoto].rating = newRating;
        });
    };

    // Function to reset all ratings via http POST.
    // On success, reset ratings in the scope, too.
    $scope.resetAllRatings = function() {
        $http.post('/dir/'+localdir+'/rate/reset', {}).success(function() {
            // set all ratings to zero
            for(var p = 0; p < $scope.photos.length; p++) {
                $scope.photos[p].rating = 0;
            }
        });
    };

    // Make HTTP POST to /save.  We've been rating photos as we go.
    // This tells the server to write to the file.
    $scope.save = function() {
        $http.post('/dir/'+localdir+'/save', {}).success(function(data) {
        });
    };

    // Move <delta> photos through the array, wrapping back
    // around at zero/end-of-array
    $scope.movePhoto = function(delta) {
        var newPhoto = ($scope.currentPhoto + delta) % $scope.photos.length;
        while (newPhoto < 0) {
            newPhoto += $scope.photos.length;
        }
        $scope.currentPhoto = newPhoto;
        $scope.socket.send(JSON.stringify({'image' : $scope.getPhotoURL(newPhoto) }));
    };
}]);

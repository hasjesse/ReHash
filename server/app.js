/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var express = require('express');
var config = require('./config/environment');

// Populate DB with sample data
if(config.seedDB) { require('./config/seed'); }

// Setup server
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var sys = require('sys')
var exec = require('child_process').exec;
require('./config/socketio')(io);
require('./config/express')(app);
require('./routes')(app);

var request = require('request');
var GoogleSheetService = require('./services/google_sheet_service');
var TweetService = require("./services/tweet_service");
var HashtagService = require("./services/hashtag_service");

var usernames = [];
var numUsers = 0;
var hashTags = [];
var judge = null;
var tweet = null;
var gameStarted = false;
var hash_tag_by_user= null;
var numHashtags = null;
var scores = [];
var tweets = [];
var hashtags = [];

var TWEET_URL = "https://docs.google.com/spreadsheets/d/1azduyest2um3zrUJFvS5upGa2LO7cReg0hob6VtGCas/export?gid=625026020&format=csv";
var HASHTAG_URL = "https://docs.google.com/spreadsheets/d/1azduyest2um3zrUJFvS5upGa2LO7cReg0hob6VtGCas/export?gid=0&format=csv";

var tweetSvc = new TweetService(TWEET_URL);
var hashTagSvc = new HashtagService(HASHTAG_URL);

Array.prototype.remove = function () {
  var what, a = arguments, L = a.length, ax;
  while (L && this.length) {
    what = a[--L];
    while ((ax = this.indexOf(what)) !== -1) {
      this.splice(ax, 1);
    }
  }
  return this;
};

io.on('connection', function (socket) {

  function getNewJudge() {
    return usernames[~~(Math.random() * usernames.length)];
  }

  function startRound(socket) {
    judge = getNewJudge();
    console.log('judge:', judge);
    console.log('players in the game: ', usernames);


      var rand = Math.floor((Math.random() * tweets.length) + 1);
      tweet = tweets[Math.floor(Math.random()*tweets.length)];

      console.log('tweet retrieved:', tweet);
      hash_tag_by_user = [];
      numHashtags = usernames.length * 5;
        console.log("retrieving hashtags");
        hash_tag_by_user = {};

        usernames.forEach(function (username, index) {
          var start = (index * 5) + 1;
          hash_tag_by_user[username] = userHashTags.slice(start, start + 5);
        });

        socket.broadcast.emit('start round', {
          tweet: tweet,
          hashtags: hash_tag_by_user,
          judge: judge,
          scores: scores
        });
        // socket.in(socket.user.uuid).emit('new_msg', {msg: 'hello'});
        socket.emit('start round', {
          tweet: tweet,
          hashtags: hash_tag_by_user,
          judge: judge,
          scores: scores
        });
    });
  }

  function startGame(socket) {
    scores = [];

    tweetSvc.getAll(function (twts) {
      tweets = twts;
      usernames.forEach(function (username, index) {
        scores.push({username: username, score: 0});
      });

      hashTagSvc.getHashTags(5, function(htags) {
        hashtags = htags;
        startRound(socket);
      }
    });
  }

  // when the client emits 'new message', this listens and executes
  socket.on('submit hashtag', function (data) {
    // we tell the client to execute 'new message'
    data.judge = judge;
    socket.broadcast.emit('send hashtag to judge', data);

    hashTags.push(data);
    console.log("hashtags " + hashTags.length);
    console.log("num users " + numUsers);

    if (hashTags.length >= numUsers - 1) {
      socket.broadcast.emit('judge is now voting', {
        username: judge,
        hashTags: hashTags
      });
    }
  });

  socket.on('new round', function (data) {
    console.log('new round');
    startGame(socket);
  });

  socket.on('join lobby', function (username) {
    socket.username = username;
    console.log('user joined lobby:', username);
    // add the client's username to the global list
    usernames.push(username);
    numUsers++;

    socket.emit('login', {
      numUsers: numUsers,
      users: usernames
    });

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user list', {users: usernames});
  });

  socket.on('debug', function () {
    socket.emit('receive debug', {
      usernames: usernames,
      gameStarted: gameStarted,
      hashTags: hashTags,
      tweet: tweet,
      user: socket.user
    });
  });

  socket.on('end round', function (data) {
    console.log('end round', data);
    socket.broadcast.emit('send winner of round', {
      username: data.username,
      hashtag: data.hashtag
    });
    socket.emit('send winner of round', {
      username: data.username,
      hashtag: data.hashtag
    });
    hashTags = [];

    scores.forEach(function(userScore) {
      if (userScore.username === data.username) {
        userScore.score++;
      }
    });
    console.log("scores: ", scores);
    startRound(socket);
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    usernames.remove(socket.username);
    numUsers--;

    if (numUsers === 1) {
      socket.broadcast.emit('send to lobby', usernames);
    } else if (socket.username === judge) {
      startRound(socket);
    }

    // echo globally that this client has left
    socket.broadcast.emit('user left', {
      username: socket.username,
      numUsers: numUsers
    });
  });
});

// Start server
server.listen(config.port, config.ip, function () {
  console.log("Route: %s", config.root);
  console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
  // console.log('The Mongodb url is: ', config.mongo.uri);
  // console.log('Facebook redirect url =: %s', config.facebook.callbackURL);
});

// Expose app
exports = module.exports = app;

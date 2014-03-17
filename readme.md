Node Tweet Stream
===========================================

[node-tweet-stream](https://github.com/SpiderStrategies/node-tweet-stream) is node twitter module that connects to the public twitter stream. It does not provide endpoints to the REST API. There are other
fine node modules that provide this functionality. It doesn't connect to twitter's user streams, since they are useless unless you're writing a mobile app. It also doesn't allow you to connect to
site streams, since you probably don't have access to that anyway.

It does provide a nice API for working with public streams, allowing you to track and untrack a list of keywords, updating the public stream behind the scenes.

## Installation

`npm install node-tweet-stream`

## Usage

This code will probably be used at an application level, not a user level because of the twitter API restriction. That said, you need to grab a twitter access token key
and secret, because the streaming API doesn't support bearer tokens. This is a limitation of twitter, not this project. If twitter provides bearer token access to their
streaming API, we can improve this.

```
var Twitter = require('node-tweet-stream')
  , t = new Twitter({
    consumer_key: '',
    consumer_secret: '',
    token: '',
    token_secret: ''
  })

t.on('tweet', function (tweet) {
  console.log('tweet received', tweet)
})

t.on('error', function (err) {
  console.log('Oh no')
})

t.track('nodejs')
t.track('pizza')

// 5 minutes later
t.track('tacos')

// 10 minutes later
t.untrack('pizza')
```

Watch yourself when updating your tracking keywords. Twitter has [guidelines](https://dev.twitter.com/docs/streaming-apis/connecting#Rate_limiting) for connection rate limiting.


Backoff strategy ripped from https://github.com/benfoxall/tweets/

License: MIT

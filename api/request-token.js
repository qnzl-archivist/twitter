const Vogel = require(`vogel`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_OAUTH_CALLBACK,
} = process.env

const twitter = new Vogel({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET,
  oauthCallback: TWITTER_OAUTH_CALLBACK,
})

module.exports = async (req, res, next) => {
  const url = await twitter.getRequestToken()

  return res.redirect(url)
}

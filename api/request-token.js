const Vogel = require(`vogel`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET
} = process.env

const twitter = new Vogel({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET,
  oauthCallback: 'http://ceb0ba2d7792.ngrok.io/api/oauth-callback'
})

module.exports = async (req, res, next) => {
  const url = await twitter.getRequestToken()

  return res.redirect(url)
}

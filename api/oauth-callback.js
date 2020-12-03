const Vogel = require(`vogel`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET
} = process.env

const twitter = new Vogel({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET
})

module.exports = async (req, res, next) => {
  const {
    oauth_token: requestToken,
    oauth_verifier: verifier
  } = req.query

  const body = await twitter.getAccessToken(requestToken, verifier)

  const {
    accessToken,
    accessTokenSecret
  } = body

  return res.json({
    accessToken,
    accessTokenSecret
  })
}

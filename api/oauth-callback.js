const fetch = require(`node-fetch`)
const Vogel = require(`vogel`)

const {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  SERVICE_CALLBACK,
  OAUTH_COMPLETE_REDIRECT
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

  if (SERVICE_CALLBACK) {
    await fetch(SERVICE_CALLBACK, {
      method: `POST`,
      headers: {
        [`Content-Type`]: `application/json`,
      },
      body: JSON.stringify(body),
    })

    if (OAUTH_COMPLETE_REDIRECT) {
      return res.redirect(OAUTH_COMPLETE_REDIRECT)
    }
  }

  return res.json({
    accessToken,
    accessTokenSecret
  })
}

// route - api/auth
var querystring = require('querystring');
var { httpRequest, getConfig } = require('../components');
const url = require('url');

module.exports = (api, opts) => {
  api.get('/logout', async (req,res) => {
    auth = new Auth()
    auth.clearCookies(res);
    await auth.init();
    return res.redirect('https://' + auth.config['AuthDomain'] + '/logout?client_id='+auth.config['UserPoolClientId']
      +'&logout_uri=https://'+url.parse(req.headers.referer || req.headers.host).host)
  })


  api.get('/refresh', async (req,res) => {
    auth = new Auth()
    await auth.init();
    var tokens = await auth.refreshTokens(req.cookies.refresh_token);
    delete myObject.refresh_token

    return res.redirect('https://' + auth.config['AuthDomain'] + '/logout?client_id='+auth.config['UserPoolClientId']
      +'&logout_uri=https://'+url.parse(req.headers.referer || req.headers.host).host)
  })

  api.get('/callback', async (req,res) => {
    auth = new Auth()
    await auth.init();
    if ('code' in req.query) {
      var tokens = await auth.authCode(req.query.code, url.parse(req.headers.referer || req.headers.host).host);
      console.log(tokens)
    }
    if (!(tokens instanceof Error)) {
      auth.setCookies(res, tokens);
    }
    return res.redirect('https://'+url.parse(req.headers.referer || req.headers.host).host)
  })

  api.get('/get_auth', async (req,res) => {
    var logoutResponse = {
      status: 'Logged in',
      redirect_url: '/api/auth/logout',
      title: 'Logout'
    }
    //If there is already an access token, then skip the rest
    if ('access_token' in req.cookies) {
      return res.json(logoutResponse)
    }
    auth = new Auth()
    await auth.init();
    var loginResponse = {
      status:'Not logged in',
      redirect_url: 'https://'+auth.config['AuthDomain']+'/login?client_id='+auth.config['UserPoolClientId']
        +'&response_type=code&scope=email+openid+phone+profile&redirect_uri=https://'
        +url.parse(req.headers.referer || req.headers.host).host,
      title: 'Login'
    }
    if (!('code' in req.query) && !('refresh_token' in req.cookies)) {
      return res.status(200).json(loginResponse)
    }
    if ('refresh_token' in req.cookies) {
      var tokens = await auth.refreshTokens(req.cookies.refresh_token);
      delete myObject.refresh_token
    }

    if (tokens instanceof Error) {
      console.log(err)
      return res.status(401).json(loginResponse)
    }
    console.log(tokens);
    auth.setCookies(res, tokens);
    return res.status(200).json(logoutResponse)
  });
}

class Auth {
  constructor() {
    this.tokenOptions = {
      httpOnly: false,
      sameSite: true,
      secure: true
    }
    this.refreshTokenOptions = {
      httpOnly: true,
      path: '/api/auth/get_auth/refresh',
      sameSite: true,
      secure: true
    }
  }

  //get config variables from SSM store
  async init() {
    this.config = await getConfig(['/AlwaysOnward/UserPoolClientId', '/AlwaysOnward/AuthDomain', '/AlwaysOnward/UserPoolClientSecret'])
  }

  // clear cookies when customer logs out
  clearCookies(res) {
    res.clearCookie('access_token', this.tokenOptions)
    res.clearCookie('id_token', this.tokenOptions)
    res.clearCookie('refresh_token', this.refreshTokenOptions)
  }

  // get a new access token from the refresh token
  refreshTokens(token) {
    var postData = querystring.stringify({
      'grant_type' : 'refresh_token',
      'refresh_token' : token,
      'client_id': this.config['UserPoolClientId'],
    });
    return this._callTokenApi(postData)
  }

  //get tokens from auth code
  authCode(code, host) {
    var postData = querystring.stringify({
      'grant_type' : 'authorization_code',
      'code' : code,
      'client_id': this.config['UserPoolClientId'],
      'redirect_uri': 'https://'+host
    });
    return this._callTokenApi(postData)
  }

  //set cookies based on tokens received
  setCookies(res, tokens) {
    var date = new Date();
    date.setDate(date.getDate() + 30)
    if ('id_token' in tokens) {
      this.tokenOptions['expires'] = date
      res.cookie('id_token', tokens.id_token, this.tokenOptions)
    }
    if ('access_token' in tokens) {
      this.tokenOptions['expires'] = new Date(new Date().getTime() + tokens.expires_in*1000)
      res.cookie('access_token', tokens.access_token, this.tokenOptions)
    }
    if ('refresh_token' in tokens) {
      this.refreshTokenOptions['expires'] = date
      res.cookie('refresh_token', tokens.refresh_token, this.refreshTokenOptions)
    }
  }
  //internal method to call the get tokens api
  _callTokenApi(postData) {
    try {
      var options = {
        hostname: this.config['AuthDomain'],
        port: 443,
        path: '/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Basic '+ Buffer.from(this.config['UserPoolClientId']+':'+this.config['UserPoolClientSecret']).toString('base64')
        }
      };
      //make the API call
      return httpRequest(options, postData)
    } catch (e) {
      console.log(e)
      return Error
    }
  }
}



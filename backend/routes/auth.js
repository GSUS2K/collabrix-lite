const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const sign = (id, username, color) => jwt.sign({ id, username, color }, process.env.JWT_SECRET, { expiresIn: '30d' });


router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields required' });

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ message: 'Username or email already taken' });

    const colors = ['#00FFBF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FD79A8', '#6C5CE7', '#00CEC9'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const user = await User.create({ username, email, password, color });

    res.status(201).json({
      token: sign(user._id, user.username, user.color),
      user: { id: user._id, username: user.username, email: user.email, color: user.color },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    res.json({
      token: sign(user._id, user.username, user.color),
      user: { id: user._id, username: user.username, email: user.email, color: user.color },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential missing' });


    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;


    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {

      if (!user.googleId) {
        user.googleId = googleId;
        user.avatarUrl = user.avatarUrl || picture;
        await user.save();
      }
    } else {

      const colors = ['#00FFBF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FD79A8', '#6C5CE7', '#00CEC9'];
      const color = colors[Math.floor(Math.random() * colors.length)];


      let baseUsername = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15) || 'User';
      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: uniqueUsername })) {
        uniqueUsername = `${baseUsername}${counter}`;
        counter++;
      }

      user = await User.create({
        username: uniqueUsername,
        email,
        googleId,
        avatarUrl: picture,
        color,
      });
    }

    res.json({
      token: sign(user._id, user.username, user.color),
      user: { id: user._id, username: user.username, email: user.email, color: user.color, avatarUrl: user.avatarUrl },
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ message: 'Google authentication failed' });
  }
});

const fetch = require('node-fetch');

router.post('/discord/token', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required' });


    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Discord Token Error:', data);
      return res.status(response.status).json(data);
    }

    const { access_token } = data;


    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const discordUser = await userRes.json();
    if (!userRes.ok) throw new Error('Failed to fetch Discord user');


    let user = await User.findOne({ discordId: discordUser.id });

    if (!user) {
      const colors = ['#00FFBF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FD79A8', '#6C5CE7', '#00CEC9'];
      const color = colors[Math.floor(Math.random() * colors.length)];


      let baseUsername = discordUser.global_name || discordUser.username;
      baseUsername = baseUsername.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15) || 'DiscordUser';

      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: uniqueUsername })) {
        uniqueUsername = `${baseUsername}${counter}`;
        counter++;
      }

      user = await User.create({
        username: uniqueUsername,
        email: discordUser.email || `${discordUser.id}@discord.local`,
        discordId: discordUser.id,
        avatarUrl: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
        color,
      });
    } else {

      user.avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
      await user.save();
    }



    res.json({
      access_token,
      collabrix_token: sign(user._id, user.username, user.color),
      user: { id: user._id, username: user.username, email: user.email, color: user.color, avatarUrl: user.avatarUrl },
    });

  } catch (err) {
    console.error('Discord Auth Error:', err);
    res.status(500).json({ message: 'Discord authentication failed' });
  }
});


router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: { id: user._id, username: user.username, email: user.email, color: user.color } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

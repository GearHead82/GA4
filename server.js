const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = 5500;

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const analyticsData = google.analyticsdata('v1beta');

// Set up EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Redirect to Google for authorization
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/analytics.readonly'
  });
  res.redirect(authUrl);
});

// Handle the OAuth2 callback
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  res.redirect('/analytics');
});

// Fetch and display Google Analytics data using EJS template
app.get('/analytics', async (req, res) => {
  if (!oauth2Client.credentials) {
    return res.redirect('/auth');
  }

  try {
    const response = await analyticsData.properties.runReport({
      auth: oauth2Client,
      property: `properties/${process.env.PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'eventCount' }
        ]
      }
    });

    const rows = response.data.rows;
    const data = {
      sessions: rows[0]?.metricValues[0]?.value || '0',
      users: rows[1]?.metricValues[0]?.value || '0',
      eventCount: rows[2]?.metricValues[0]?.value || '0'
    };

    res.render('analytics', { data });
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

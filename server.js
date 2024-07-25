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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/analytics.readonly'
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  res.redirect('/analytics');
});

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
    let data = {
      sessions: '0',
      users: '0',
      eventCount: '0'
    };

    if (rows && rows.length > 0) {
      const metricValues = rows[0].metricValues;
      if (metricValues.length > 0) {
        data.sessions = metricValues[0]?.value || '0';
        data.users = metricValues[1]?.value || '0';
        data.eventCount = metricValues[2]?.value || '0';
      }
    }

    res.render('analytics', { data });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).send(error.toString());
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

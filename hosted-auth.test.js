const express = require('express');
const request = require('supertest');
const { hostedAuth } = require('./hosted-auth');
function app(enabled = true) {
  const app = express();
  app.use(hostedAuth({ enabled }));
  app.all('*', (req, res) => res.json({ user: req.fmdsUser || null }));
  return app;
}
const identity = { 'X-FMDS-User-Email': 'matt@voyagefoods.com', 'X-FMDS-App-Id': 'matt-planner', 'X-FMDS-Can-Edit': 'false' };
describe('FMDS hosting boundary', () => {
  test('protects UI and API while allowing health', async () => {
    expect((await request(app()).get('/')).status).toBe(401);
    expect((await request(app()).get('/api/data/vf_orders')).status).toBe(401);
    expect((await request(app()).get('/health')).status).toBe(200);
    expect((await request(app()).get('/').set(identity)).status).toBe(200);
  });
  test('denies viewer writes and only accepts gateway edit permission', async () => {
    expect((await request(app()).put('/api/data/vf_orders').set(identity)).status).toBe(403);
    expect((await request(app()).put('/api/data/vf_orders').set({ ...identity, 'X-FMDS-Can-Edit': 'true' })).status).toBe(200);
  });
  test('does not expose stored users or allow local auth/access changes', async () => {
    const res = await request(app()).get('/api/data/vf_users').set(identity);
    expect(res.body.value).toEqual([{ id: identity['X-FMDS-User-Email'], username: identity['X-FMDS-User-Email'], role: 'viewer' }]);
    expect((await request(app()).put('/api/data/vf_users').set({ ...identity, 'X-FMDS-Can-Edit': 'true' })).status).toBe(403);
    expect((await request(app()).post('/api/login').set(identity)).status).toBe(409);
  });
  test('preserves standalone behavior when not enabled', async () => {
    expect((await request(app(false)).get('/')).status).toBe(200);
  });
});

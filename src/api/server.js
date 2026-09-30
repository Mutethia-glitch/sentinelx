const { auditRepository }=require('../data/audit-repository');
const { auditService }=require('../audit/service');
const { auditHandler }=require('./audit-handler');
const { auditPage }=require('./audit-page');
const { reportRepository }=require('../data/report-repository');
const { reportService }=require('../reports/service');
const { reportHandler }=require('./report-handler');
const { dashboardRepository }=require('../data/dashboard-repository');
const { dashboardService }=require('../dashboard/service');
const { dashboardHandler }=require('./dashboard-handler');
const { dashboardPage }=require('./dashboard-page');
const { notificationRepository } = require('../data/notification-repository');
const { notificationService } = require('../notifications/service');
const { notificationHandler } = require('./notification-handler');
const { notificationPage } = require('./notification-page');
const { responseRepository } = require('../data/response-repository');
const { responseService } = require('../responses/service');
const { responseHandler } = require('./response-handler');
const { investigationRepository } = require('../data/investigation-repository');
const { investigationService } = require('../investigations/service');
const { investigationHandler } = require('./investigation-handler');
const { incidentRepository } = require('../data/incident-repository');
const { incidentService } = require('../incidents/service');
const { incidentHandler } = require('./incident-handler');
const { incidentPage } = require('./incident-page');
const { correlationRepository } = require('../data/correlation-repository');
const { correlationEngine } = require('../correlation/engine');
const { alertRepository } = require('../data/alert-repository');
const { alertService } = require('../alerts/service');
const { alertHandler } = require('./alert-handler');
const { alertPage } = require('./alert-page');
const { detectionRepository } = require('../data/detection-repository');
const { detectionEngine } = require('../detection/engine');
const { ruleRepository } = require('../data/rule-repository');
const { ruleService } = require('../rules/service');
const { ruleHandler } = require('./rule-handler');
const { categoryRepository } = require('../data/category-repository');
const { categoryService } = require('../threats/service');
const { categoryHandler } = require('./category-handler');
const { eventViewService } = require('../events/view-service');
const { eventViewHandler } = require('./event-view-handler');
const { eventPage } = require('./event-page');
const { ingestionService, approvedSources } = require('../events/ingestion');
const { eventRepository } = require('../data/event-repository');
const { ingestionHandler } = require('./ingestion-handler');
const http = require('node:http');
const { configFromEnv } = require('../auth/config');
const { createPool } = require('../data/pool');
const { authRepository } = require('../data/auth-repository');
const { authService } = require('../auth/service');
const { authHandler } = require('./auth-handler');
const { accessRepository } = require('../data/access-repository');
const { accessService } = require('../access/service');
const { accessHandler } = require('./access-handler');
const { accessPage } = require('./access-page');
function createServer(service, config, access = null, ingestion = null, views = null, categories = null, rules = null, alerts = null, incidents = null, investigations = null, responses = null, notifications = null, dashboard = null, reports = null, audit = null) {
  const auditing = audit ? auditHandler(audit, config) : null;
  const reporting = reports ? reportHandler(reports, config) : null;
  const dashboardMetrics = dashboard ? dashboardHandler(dashboard, config) : null;
  const notificationInbox = notifications ? notificationHandler(notifications, config) : null;
  const responseWorkflow = responses ? responseHandler(responses, config) : null;
  const investigationWorkspace = investigations ? investigationHandler(investigations, config) : null;
  const incidentManagement = incidents ? incidentHandler(incidents, config) : null;
  const alertManagement = alerts ? alertHandler(alerts, config) : null;
  const ruleManagement = rules ? ruleHandler(rules, config) : null;
  const taxonomy = categories ? categoryHandler(categories, config) : null;
  const reading = views ? eventViewHandler(views, config) : null;
  const events = ingestion ? ingestionHandler(ingestion, config) : null;
  const authentication = authHandler(service, config);
  const authorization = access ? accessHandler(access, config) : null;
  const server = http.createServer({ maxHeaderSize: 16384 }, (req, res) => {
    if (auditing && req.url.startsWith('/api/audit')) return auditing(req, res);
    if (reporting && req.url.startsWith('/api/reports')) return reporting(req, res);
    if (dashboardMetrics && req.url.startsWith('/api/dashboard')) return dashboardMetrics(req, res);
    if (notificationInbox && req.url.startsWith('/api/notifications')) return notificationInbox(req, res);
    if (responseWorkflow && req.url.startsWith('/api/responses')) return responseWorkflow(req, res);
    if (investigationWorkspace && req.url.startsWith('/api/investigations')) return investigationWorkspace(req, res);
    if (incidentManagement && req.url.startsWith('/api/incidents')) return incidentManagement(req, res);
    if (alertManagement && req.url.startsWith('/api/alerts')) return alertManagement(req, res);
    if (ruleManagement && req.url.startsWith('/api/rules')) return ruleManagement(req, res);
    if (taxonomy && req.url.startsWith('/api/threat-categories')) return taxonomy(req, res);
    if (auditPage(req, res)) return;
    if (dashboardPage(req, res)) return;
    if (notificationPage(req, res)) return;
    if (incidentPage(req, res)) return;
    if (alertPage(req, res)) return;
    if (eventPage(req, res)) return;
    if (reading && req.method === 'GET' && req.url.startsWith('/api/events') && !req.url.startsWith('/api/events/raw')) return reading(req, res);
    if (events && req.url.startsWith('/api/events')) return events(req, res);
    if (accessPage(req, res)) return;
    if (authorization && req.url.startsWith('/api/access/')) return authorization(req, res);
    return authentication(req, res);
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.timeout = 15000;
  server.keepAliveTimeout = 5000;
  return server;
}
async function main() {
  let pool;
  try {
    const config = configFromEnv();
    pool = createPool();
    await pool.query('SELECT token_hash FROM auth_sessions LIMIT 0');
    const service = authService(authRepository(pool), config);
    const access = accessService(accessRepository(pool), service);
    const server = createServer(service, config, access,
      ingestionService(eventRepository(pool), access, approvedSources(), detectionEngine(detectionRepository(pool), correlationEngine(correlationRepository(pool)))),
      eventViewService(eventRepository(pool), access),
      categoryService(categoryRepository(pool), access),
      ruleService(ruleRepository(pool), access),
      alertService(alertRepository(pool), access),
      incidentService(incidentRepository(pool), access),
      investigationService(investigationRepository(pool), access),
      responseService(responseRepository(pool), access),
      notificationService(notificationRepository(pool), access),
      dashboardService(dashboardRepository(pool), access),
      reportService(reportRepository(pool), access),
      auditService(auditRepository(pool), access));
    server.on('error', () => { console.error('Authentication server could not start.'); process.exitCode = 1; pool.end(); });
    server.listen(config.port, '127.0.0.1', () => console.log(`SentinelX authentication API listening on loopback port ${config.port}.`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(() => pool.end());
    });
  } catch {
    console.error('Authentication server could not start. Check configuration, database access and migrations locally.');
    if (pool) await pool.end();
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = { createServer };

const { apiSecurityBoundary,clientAddress } = require('./security');
const {authPages}=require('./auth-pages');
const {emailConfig,emailDelivery}=require('../email/delivery');
const { frontendShared } = require('./frontend-shared');
const { externalWebhook } = require('../integrations/webhook');
const { collectorConfig, collectorHandler } = require('../integrations/collector');
const { vercelFirewallConfig, vercelFirewallHandler } = require('../integrations/vercel-firewall');
const { loginContainmentRepository } = require('../integrations/login-containment');
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
function createServer(service, config, access = null, ingestion = null, views = null, categories = null, rules = null, alerts = null, incidents = null, investigations = null, responses = null, notifications = null, dashboard = null, reports = null, audit = null, apiSecurity = null, collector = null, vercelFirewall = null) {
  const security=apiSecurity||apiSecurityBoundary({address:req=>clientAddress(req,config.trustedProxyIps||[])});
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
    // Production APP_ORIGIN is HTTPS; never scope HSTS to unrelated Render subdomains.
    if(config.secureCookie)res.setHeader('Strict-Transport-Security','max-age=31536000');
    if(req.url==='/healthz'){
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
      if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end(JSON.stringify({error:'Method not allowed.'}));}
      res.statusCode=200;return res.end(JSON.stringify({status:'ok',...(config.tenant?.id?{tenantId:config.tenant.id,origin:config.origin}:{})}));
    }
    if (security(req, res)) return;
    if (vercelFirewall && req.url==='/api/connectors/vercel-firewall') return vercelFirewall(req,res);
    if (collector && req.url.startsWith('/api/connectors/')) return collector(req,res);
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
    if (frontendShared(req, res)) return;
    if (authPages(req, res)) return;
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
    if(config.tenant){
      const profiles=await pool.query('SELECT tenant_id,company_name,slug FROM tenant_profile');
      if(profiles.rows.length!==1||profiles.rows[0].tenant_id!==config.tenant.id||profiles.rows[0].company_name!==config.tenant.name||profiles.rows[0].slug!==config.tenant.slug)throw new Error('Tenant identity mismatch.');
    }
    const mailer=emailDelivery(emailConfig());
    const service = authService(authRepository(pool), config,mailer);
    const access = accessService(accessRepository(pool), service,{tenant:config.tenant,mailer,otpSecret:config.otpSecret,otpSeconds:config.otpSeconds});
    const integration = externalWebhook();
    const connector = collectorConfig(process.env, config.tenant);
    const firewall = vercelFirewallConfig(process.env, config.tenant);
    if (connector||firewall) await pool.query('SELECT event_id FROM connector_receipts LIMIT 0');
    if (connector?.containLogin) await pool.query('SELECT trigger_event_id FROM connector_login_blocks LIMIT 0');
    const server = createServer(service, config, access,
      ingestionService(eventRepository(pool), access, approvedSources(), detectionEngine(detectionRepository(pool), correlationEngine(correlationRepository(pool))), integration),
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
      auditService(auditRepository(pool), access), null,
      collectorHandler(connector, eventRepository(pool), detectionEngine(detectionRepository(pool), correlationEngine(correlationRepository(pool))),loginContainmentRepository(pool)),
      firewall ? vercelFirewallHandler(firewall,eventRepository(pool),detectionEngine(detectionRepository(pool),correlationEngine(correlationRepository(pool)))) : null);
    server.on('error', () => { console.error('Authentication server could not start.'); process.exitCode = 1; pool.end(); });
    server.listen(config.port, config.bindHost, () => console.log(`SentinelX server listening on configured port ${config.port}.`));
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

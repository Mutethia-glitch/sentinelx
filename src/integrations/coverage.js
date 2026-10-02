'use strict';
const {CATEGORY_CODES}=require('../threats/taxonomy');
const {EVIDENCE_SIGNALS}=require('./evidence-catalog');

// Source eligibility is a contract map, not a statement that a customer
// is receiving telemetry or that an individual attack has been detected.
const PROVIDER_LABELS=Object.freeze({
 application:'Website / application backend',identity:'Identity provider / role audit',
 network:'Firewall / network provider',mail:'Email security provider',
 endpoint:'Endpoint security / EDR',storage:'Storage / egress provider',
 analyst:'Reviewed analyst evidence',ci:'CI/CD and build integrity'
});
const firstPartyCategories=new Set(['BRUTE_FORCE','RECONNAISSANCE']);
const REQUIREMENTS=Object.freeze(CATEGORY_CODES.map(categoryCode=>{
 const entries=Object.entries(EVIDENCE_SIGNALS).filter(([,spec])=>spec.categoryCode===categoryCode);
 if(!entries.length)throw new Error('Threat category has no accepted evidence contract.');
 const issuers=[...new Set(entries.map(([,spec])=>spec.issuer))];
 return Object.freeze({categoryCode,issuers:Object.freeze(issuers),
  signals:Object.freeze(entries.map(([signal])=>signal)),
  providers:Object.freeze(issuers.map(issuer=>PROVIDER_LABELS[issuer]||issuer))});
}));
const supported=Object.freeze(REQUIREMENTS.map(c=>c.categoryCode));

function integrationCoverage(pool,websites,feeds=[],config={},managed=null){
 if(!config.tenant?.id)throw new Error('Integration readiness requires an isolated tenant.');
 const configured=Array.isArray(feeds)?feeds.map(({issuer,name})=>({issuer,name})):[];
 return{
  async list(){
   const [siteInfo,activity,managedFeeds]=await Promise.all([
    websites.list(),
    pool.query(`SELECT normalized_data->'metadata'->>'categoryCode' AS category_code,
      count(*)::int AS total, max(occurred_at) AS latest
      FROM security_events WHERE normalized_data->'metadata'->>'tenantId'=$1
      AND normalized_data->'metadata'->>'sourceContract' IN ('security-evidence-v1','sentinelx-self-v1')
      AND (source LIKE 'site.%' OR source LIKE 'evidence.%' OR source='sentinelx-internal')
      AND normalized_data->'metadata'->>'categoryCode'=ANY($2::text[])
      GROUP BY normalized_data->'metadata'->>'categoryCode'`,
     [config.tenant.id,supported]),
    managed?managed.list():Promise.resolve([])
   ]);
   const observations=new Map(activity.rows.map(row=>[row.category_code,row]));
   const available=[...configured,...managedFeeds.filter(feed=>['ISSUED','REPORTING'].includes(feed.status))];
   const activeSites=(siteInfo.sites||[]).filter(site=>['ISSUED','REPORTING'].includes(site.status));
   return{
    purpose:'Integration planning only. Observations do not by themselves establish live attack-detection acceptance.',
    categories:REQUIREMENTS.map(item=>{
     const observed=observations.get(item.categoryCode),count=Number(observed?.total||0);
     const eligibleSources=item.issuers.reduce((n,issuer)=>n+
       available.filter(feed=>feed.issuer===issuer).length+
       (issuer==='application'?activeSites.length:0),0)+
       (config.selfMonitorEnabled&&firstPartyCategories.has(item.categoryCode)?1:0);
     return{...item,eligibleSources,observedEventCount:count,
      lastObservedAt:observed?.latest instanceof Date?observed.latest.toISOString():null,
      state:count>0?'EVIDENCE_OBSERVED_NOT_LIVE_ACCEPTED':
       eligibleSources>0?'SOURCE_CONFIGURED_CATEGORY_UNVERIFIED':'SOURCE_REQUIRED'};
    })
   };
  }
 };
}
module.exports={REQUIREMENTS,integrationCoverage,PROVIDER_LABELS};

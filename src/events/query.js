const { parseFilters } = require('../search/filters');
function eventQuery(params){return parseFilters('event',params);}
module.exports={eventQuery};

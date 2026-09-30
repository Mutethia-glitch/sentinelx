const { parseFilters } = require('../search/filters');
function incidentQuery(params){return parseFilters('incident',params);}
module.exports={incidentQuery};

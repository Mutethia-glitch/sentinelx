const { parseFilters } = require('../search/filters');
function alertQuery(params){return parseFilters('alert',params);}
module.exports={alertQuery};

var request = require("request");
var jsonfile = require('jsonfile');
var json2csv = require('json2csv');
var fs = require('fs');
var cheerio = require('cheerio');

urls = [
	'axes', 'bows', 'claws', 'daggers', 'fishing_rods', 'maces', 'staves', 'swords', 'wands', 'quivers', 
	'body_armours', 'boots', 'gloves', 'helmets', 'shields', 'belts', 'amulets', 'rings', 'flasks', 'jewels'
]

//urls = ['swords']

console.log('- [ ] Begin scraping \x1b[36mpoe wiki\x1b[0m.');
urls.forEach(function(url, index){
	var options = {
		method: 'POST',
		url: 'http://pathofexile.gamepedia.com/List_of_unique_' + urls[index],
		
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			'cache-control': 'no-cache'
		}
	};

	console.log('- [ ] Scraping \x1b[35m'+ urls[index] +'\x1b[0m.');
	request(options, function (error, response, body) {
		if (error) throw new Error(error);
		
		console.log('- [x] Scraped \x1b[35m'+ urls[index] +'\x1b[0m.');
		console.log('    - [ ] Begin parsing \x1b[31m'+ urls[index] +'\x1b[0m.');
		var HTML = response.body;
		$ = cheerio.load(HTML);
		var items = [];

		var wikitables = $('.wikitable');

		wikitables.each(function(i, table){
			var columnsToParse = {};
			var headers = $(this).find('th');

			// find out which columns to parse
			headers.each(function(j, header){
				title = $(this).find('abbr').attr('title')
				text  = $(this).find('abbr').text();
				if (typeof title !== undefined) {
					var statsIWant = ['AR', 'ES', 'EV', 'Damage', 'pDps', 'eDps', 'DPS', 'aps']
					var match = InArray(text, statsIWant);
					if (match) {
						tempObj = {}
						tempObj.name = match
						tempObj.index = j
						columnsToParse[match] = tempObj	
					}
				}
			})

			var rows = $(this).find('tr')				
			rows.each(function(j, row){	
				var item = {}			
				var tempObj = {};
				tempObj.name = $(this).find('td').first().find('a').first().text();

				var modsColumnText = $(this).find('td').last().html();
				var modsRaw = []
				tempObj.mods = []
				if (modsColumnText) {				
					var modsColumnText = modsColumnText.replace(/.*item-stat-separator.*?>/g, "");
					var modsRaw = modsColumnText.split("<br>")

					modsRaw.forEach(function(value, index){
						value = value.replace(/(<.*?>)/g, "");

						var modname = value;
						var range_regex = /(\([-+.0-9]+?\)).*?(\([-+.0-9]+?\))|(\([-+.0-9]+?\))/gi;
						//var range_regex = /(\(.*?\)).*?(\(.*?\))|(\d+(\.?\d+)? to )?(\(.*?\))/gi;
						var match = range_regex.exec(modname);
						var range = []

						if (match == null) return;									
						$(match).each(function(l, values){			
							if(l > 0) {		
								var values_regex = /(\d+.*) ?(to|-) ?(\d+.*)?/gi;
								var val_match = values_regex.exec(values);
								var temp = []

								// matches "1 to" in for example "adds 1 to (20-40) lightning damage" and creates a range
								// with "1"
								var reg = /(\d+) to/gi;	
								var singleValRangeMatch = reg.exec(val_match)	
								if (singleValRangeMatch) {
									//console.log('ding');
								}

								$(val_match).each(function(l, val){
									if (typeof val !== "undefined" && l > 0 && l != 2) {						
										val = val.replace(/ |\)/g, "");									
										temp.push(parseFloat(val));	
									}
								})	
								if(temp.length > 0) range.push(temp);
							}
						})

						var mod = {}																																																																														
						modname = modname.replace(/(\([-+.0-9]+?\)).*?(\([-+.0-9]+?\))|(\([-+.0-9]+?\))/g, "#");				
						mod.name =  modname.replace(/# %/g, "#%");
						mod.ranges = range; 
						tempObj.mods.push(mod);	
					})	

					// make sure not to push the same item more than once (atziris splendour)
					if(tempObj.mods.length > 0) {
						item = tempObj;
						var foundItem = false;
						// add missing mods (atziris splendour)
						items.forEach(function(value,index){
							if(value.name == item.name) {
								foundItem = true
								item.mods.forEach(function(mod, j){
									var found = false;
									if(typeof item.mods !== 'undefined') {
										value.mods.forEach(function(elmod,k){		
											if(elmod.name == mod.name){
												found = true;										
												if (value.mods[k].ranges[0] > mod.ranges[0]){
													value.mods[k].ranges[0] = mod.ranges[0]
												}
												if (value.mods[k].ranges[1] < mod.ranges[1]){
													value.mods[k].ranges[1] = mod.ranges[1]
												}										
											}
										})
										if(!found) {
											value.mods.push(mod);
										}
									}
								})
							}							
						})
						if (!foundItem) {
							items.push(item);
						}						
					}
				}	

				
				// parse items variable defense and offense stats /armour/evasion/es/block/dps/aps...
				var stats = [];
				
				for (var key in columnsToParse)	{
					var index = columnsToParse[key].index;
					var value = $(this).find('td').eq(index).text();
					var ems = $(this).find('td').eq(index).find('em');

					// is weapon dmg?
					if (ems.length > 0) {
						var foundRange = false
						var tempValue = ""
						ems.each(function(l, em){
							var t = $(this).text();
							var c = $(this).attr('class')

							// exclude ele/chaos dmg since they can be retrieved from mods (they don't rely on the items bases stats)
							var match = c.match(/lightning|chaos|cold|fire|value/g)
							if (match) {
								return
							}

							// class -mod is only assigned if we have dmg ranges
							var match = c.match(/mod/g)
							if (match) {
								foundRange = true
								tempValue += t
							}	
						})

						if (!foundRange) {
							value = ""	
						}
						else  {
							value = tempValue
						}						
					}

					var re = /(\d+.?\d+)/ig;
					var match = value.match(re)

					// check if value range, we don't want single values
					if (match) {
						var q20 = columnsToParse[key].name.match(/q20/gi);
						if (match[3]){
							var tempObj = {}
							tempObj.name   = columnsToParse[key].name;
							tempObj.ranges = [ 
								[parseFloat(q20 ? match[0] * 1.2 : match[0]), parseFloat(q20 ? match[1] * 1.2 : match[1])], 
								[parseFloat(q20 ? match[2] * 1.2 : match[2]), parseFloat(q20 ? match[3] * 1.2 : match[3])] 
							]
							stats.push(tempObj);	
						}
						else if (match[1]) {
							var tempObj = {}
							tempObj.name   = columnsToParse[key].name;
							tempObj.ranges = [ [parseFloat(q20 ? match[0] * 1.2 : match[0]), parseFloat(q20 ? match[1] * 1.2 : match[1])] ]
							stats.push(tempObj);	
						}
					}
				}
				
				items.forEach(function(el, i){
					if(el.name == item.name) {
						if(typeof el.stats === 'undefined') {
							//el.stats = []
							if(stats.length > 0) {
								el.stats = []
								//el.stats = stats	
							}								
						}

						// check if stat already exists
						// if yes, overwrite the existing range values only if necessary
						// only case this should happen so far is atziris splendour							
						stats.forEach(function(stat, j){
							var found = false;
							el.stats.forEach(function(elstat,k){		
								if(elstat.name == stat.name){
									found = true;
									if(typeof el.stats !== 'undefined') {
										if(el.stats[k].ranges[0] > stat.ranges[0]){
											el.stats[k].ranges[0] = stat.ranges[0]
										}
										if(el.stats[k].ranges[1] < stat.ranges[1]){
											el.stats[k].ranges[1] = stat.ranges[1]
										}
									}
								}
							})
							if(!found) {
								el.stats.push(stat);
							}
						})						
					}
				})
				
			})
		})

		var uniques = { "uniques" : items }
		console.log('    - [x] Parsed \x1b[31m'+ urls[index] +'\x1b[0m.');		

		var file = 'json/' + urls[index] + '.json'
		console.log('');
		console.log('- [ ] Saving data to \x1b[32m'+urls[index]+'.json\x1b[0m.');
	  	jsonfile.writeFile(file, uniques, function(err) {
	  		if(err){
	  			console.error(err)				  			
	  		}
			else {						
				console.log('- [x] \x1b[32m'+urls[index]+'.json\x1b[0m saved.');
			}
		})		
		
	})		
})	
console.log('- [x] Scraped \x1b[36mpoe wiki\x1b[0m.');

function InArray(value, array) {
	var match
	if (typeof value === "string") {
		array.forEach(function(el, index){
			if (value.toLowerCase() == array[index].toLowerCase()) {
				if(value == "AR") {
					match = "Armour"
				} else if (value == "EV") {
					match = "Evasion Rating" 
				} else if (value == "ES") {
					match = "Energy Shield" 
				} else if (value == "pDPS") {
					match = "Physical Dps (Q20)" 
				} else if (value == "eDPS") {
					match = "Elemental Dps" 
				} else {
					match = value
				}
			}
		})
		return (match) ? match : false
	}
	else {
		array.forEach(function(el, index){
			if (value == array[index]) {
				match = value
			}
		})
		return (match) ? match : false
	}	
}

var request = require("request");
var jsonfile = require('jsonfile');
var json2csv = require('json2csv');
var fs = require('fs');
var cheerio = require('cheerio');

try {
	fs.unlinkSync('uniques.json');	
} catch (err) {}

var options = {
	method: 'POST',
	url: 'http://poedb.tw/us/unique.php?l=1',
	
	headers: {
		'content-type': 'application/x-www-form-urlencoded',
		'cache-control': 'no-cache'
	}
};


console.log('- [ ] Begin scraping \x1b[36mpoedb.tw\x1b[0m');
request(options, function (error, response, body) {
	if (error) throw new Error(error);
	
	console.log('- [x] Scraped \x1b[36mpoedb.tw\x1b[0m for all Unique Items.');
	console.log('- [ ] Begin parsing of items with variable mods.');
	var HTML = response.body;
	$ = cheerio.load(HTML);
	// Find all mods 
	var x = $('span[class=item_magic]').each(function(i, el){
		// Find all <br> inside these mods 
		var brs = $(this).find('br');

		// Replace <br>'s to break these combined mods up into seperate mods 
		var s = "";	
		$(brs).each(function(j, br){			
			if(j == 0) {
				s += '<span class="item_magic">' + $(this)['0'].prev.data + '</span>';
			}
			s += '<br><span class="item_magic">' + $(this)['0'].next.data + '</span>';					
			
			if(j == $(brs).length-1) {
				$(el).replaceWith(s);		
			}
			
		})
		$.html();		
	})

	var a = $('tbody');

	var count = 0;
	var items = []

	a.each(function(i, body) {
		var aself = $(this);
		var b = aself.find('tr');
		var item = {};

		b.each(function(j, loopitem) {			
			var bself = $(this);
			var tempObj = {};
			var desc = bself.find('a').text();
			tempObj.name = bself.find('span').last().text();

			var foundItem = false;
			items.forEach(function(item) {
				if(item.name == tempObj.name) {
					foundItem = true;			
				}
			})
			if(foundItem) return;

			tempObj.base = desc.replace(RegExp(tempObj.name, "g"), "").trim();
			tempObj.mods = []
			bself.find('span[class=item_magic]').each(function(k, el) {
				var modname = ($(this).html());
				var range_regex = /(\(.*?\)).*?(\(.*?\))|(\(.*?\))/gi;
				var match = range_regex.exec(modname);
				var range = []

				if (match == null) return;				
				$(match).each(function(l, values){					
					if(l > 0) {					
						var values_regex = /(\d+.*) ?to ?(\d+.*)?/gi;
						var val_match = values_regex.exec(values);
						var temp = []
						$(val_match).each(function(l, val){
							if (typeof val !== "undefined" && l > 0) {						
								val = val.replace(/ |\)/g, "");
								temp.push(parseFloat(val));	
							}
						})	
						if(temp.length > 0) range.push(temp);
					}
				})

				var mod = {}
				modname = modname.replace(/(\(.*?\)).*?(\(.*?\))|(\(.*?\))/g, "#");				
				mod.name =  modname.replace(/# %/g, "#%");
				mod.ranges = range; 
				tempObj.mods.push(mod);	
			})
			
			if(tempObj.mods.length > 0) {
				item = tempObj;
				items.push(item);
			}
		})
	});			

	console.log('- [x] Done parsing items.');
	var uniques = { "uniques" : items }
	
//--------------------------------------------------------------------------------------------------

	urls = [
		'axes', 'bows', 'claws', 'daggers', 'fishing_rods', 'maces', 'staves', 'swords', 'wands', 'quivers', 
		'body_armours', 'boots', 'gloves', 'helmets', 'shields', 'belts', 'amulets', 'rings', 'flasks', 'jewels'
	]

	urls = ['body_armours']

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
			//fs.writeFileSync("temp.html", $('html'));

			var wikitables = $('.wikitable');

			wikitables.each(function(i, table){
				var columnsToParse = {}
				var headers = $(this).find('th')
				// find out which columns to parse
				headers.each(function(j, header){
					title = $(this).find('abbr').attr('title')
					if (typeof title !== undefined) {
						var statsIWant = ['Armour', 'Energy Shield', 'Evasion Rating', 'Damage', 'pDPS', 'eDPS', 'DPS', 'APS']
						var match = InArray(title, statsIWant);
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
					var name = $(this).find('td').first().find('a').first().text();
					var stats = []
					console.log(name);
					
					for (var key in columnsToParse)	{
						var index = columnsToParse[key].index;
						var value = $(this).find('td').eq(index).text();

						var re = /\(?(\d+.?\d+)\D?(\d+.?\d+)?\)?/i;
						var re = /(\d+.?\d+)/ig;
						var match = value.match(re)
						
						// check if value range, we don't want single values
						if (match) {
							if (match[1]) {
								var tempObj = {}
								tempObj.name   = columnsToParse[key].name;
								tempObj.ranges = [ match[0], match[1] ]
								stats.push(tempObj);							
							}
						}
					}

					uniques.uniques.forEach(function(el, i){
						if(el.name == name) {
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
										if(el.stat[k].ranges[0] > stat.ranges[0]){
											el.stat[k].ranges[0] = stat.ranges[0]
										}
										if(el.stat[k].ranges[1] < stat.ranges[1]){
											el.stat[k].ranges[1] = stat.ranges[1]
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

			console.log('    - [x] Parsed \x1b[31m'+ urls[index] +'\x1b[0m.');

			if ((index + 1) == urls.length){
				console.log('- [x] Scraped \x1b[36mpoe wiki\x1b[0m.');
				var file = 'uniques.json'
				console.log('');
				console.log('- [ ] Saving data to \x1b[32muniques.json\x1b[0m.');
			  	jsonfile.writeFile(file, uniques, function(err) {
			  		if(err){
			  			console.error(err)				  			
			  		}
					else {						
						console.log('- [x] \x1b[32muniques.json\x1b[0m saved.');
					}
				})		
			}
		})		
	})	
});


function InArray(value, array) {
	var match
	if (typeof value === "string") {
		array.forEach(function(el, index){
			if (value.toLowerCase() == array[index].toLowerCase()) {
				match = value
			}
		})
		return (match) ? value : false
	}
	else {
		array.forEach(function(el, index){
			if (value == array[index]) {
				match = value
			}
		})
		return (match) ? value : false
	}	
}

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

request(options, function (error, response, body) {
	if (error) throw new Error(error);
	
	var HTML = response.body;
	$ = cheerio.load(HTML);
	/* Find all mods */
	var x = $('span[class=item_magic]').each(function(i, el){
		/* Find all <br> inside these mods */
		var brs = $(this).find('br');

		/* Replace <br>'s to break these combined mods up into seperate mods */
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

	//fs.writeFileSync("temp.html", $('html'));
    //fs.readFile('temp.html', 'utf8', function (err,data) {	
	//$ = cheerio.load(data);
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

			//if(item.name[] == tempObj.name) return;
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

	var file = 'uniques.json'
  	jsonfile.writeFile(file, items, function(err) {
  		if(err){
  			console.error(err)	
  		}
		else {
			console.log('json file saved.');
		}
	})	
	//	})
	//}); 			
});



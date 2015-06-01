# OVERVIEW

artifactory-publisher is a simple tool for publishing files to [Artifactory](http://www.jfrog.com/artifactory/) via its REST API.

It provider the following API:

## publish(filePath, artUrl, options)

Publish `filePath` file (artifact) to `artUrl` url with using `options`.

Returns a `Q` promise to be resolved when the artifact has published.

### filePath
Type: `String`  
Required: yes  

A path to a file to publish (in terms of `fs` Node module).

### artUrl
Type: `String`  
Required: yes  

Fully qualified url of artifact.
For example 'http://artifacts.mydomain.com:8001/my-repo/MyProduct/1.1/Subsystem1/MyProduct.Subsystem1.1.0.0.nupkg'
Here:
* "http://artifacts.mydomain.com:8001/" - base Artifactory url (it usually contains /artifactory path)  
* "my-repo" - repository name  
* "MyProduct/1.1/Subsystem1/" - path in repository  
* "MyProduct.Subsystem1.1.0.0.nupkg" - file name (package)  

### options
Type: `Object`  
Required: no  

Options object.  

#### options.credentials
Type: `Object`  
Required: no  

An object with fields:  
* username - Artifactory user name  
* password - Artifactory user password  

#### options.proxy
Type: `String`  
Required: no  

A proxy url to use for sending http requests.  

# USAGE

Here's a simple app (to run under Node) which publishes nuget packages into custom folders depending on their file names (it's hard to implement via Repository Layout in Artifactory).

```js
var fs = require("fs");
var path = require("path");
var Q = require("Q");
var async = require("async");
var publisher = require("artifactory-publisher");

var artUrlBase = "http://artifacts.mydomain.com/my-repo/";

var options = {
	credentials: {
		username: "user1",
		password: "password2"
	}
	//proxy: "http://localhost:8888" - to debug with Fiddler
}

var args = [].splice.call(process.argv, 2);
var folderPath;
if (args.length === 0) {
	console.log("USAGE: node publish.js path/to/folder");
	return;
} else  {
	folderPath = args[0];
}

function extractProps (filePath) {
	// XFW3.Core.1.16.0.nupkg => {product: "XFW3", version: "1.16"}
	// XFW3.SmartClient.1.15.2.nupkg => {product: "XFW3.SmartClient", version: "1.15"}
	// XFW3.WebClient.0.19.0.nupkg => {product: "XFW3.WebClient", version: "0.19"}
	if (!fs.statSync(filePath).isFile()) { return; }
	var filename = path.parse(filePath).name;
	if (!filename) { return; }
	var parts = /(.*)\.([\d]+\.[\d]+)\.[\d]+.*\.nupkg/.exec(filename)
	if (!parts) { return; }

	return {
		product: parts[1],
		version: parts[2]
	};
}

fs.readdir(folderPath, function (err,files) {
	if (err != null) {
		throw err;
	}
	async.eachSeries(files, function (fileName, cb) {
		var filePath = path.resolve(folderPath + path.sep + fileName);
		var props = extractProps(filePath);
		if (!props) { 
			cb(); 
			return; 
		}
		var product = props.product.toLowerCase();
		if (product.indexOf("xfw3.webclient") === 0)  {
			product = "WebClient";
		} else if (product.indexOf("xfw3.smartclient") === 0) {
			product = "XFW3.SmartClient";
		} else if (product.indexOf("xfw3") === 0) {
			product = "XFW3";
		} else {
			cb(); 
			return;
		}
		var artUrl = artUrlBase + product + "/" + props.version + "/" + fileName;
		console.log("Publishing " + filePath + " to " + artUrl);
		
		// for test: options.dryRun = true;
		publisher.publish(filePath, artUrl, options).then(function () {
			console.log("OK");
			cb();
		});
	}, function () {
		console.log("Done!\n");
	});
});
```
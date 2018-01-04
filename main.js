var 
	request = require('request'),
    fs = require('fs'),
    Q = require('q'),
    crypto = require('crypto'),
    urlUtil = require('url'),
    _ = require('lodash');

function uploadFile (filePath, artUrl, options, headers) {
    var deferred = Q.defer();
    options = options || {};
    var credentials = options.credentials;

    var ajaxSettings = _.assign({
        method: 'PUT',
        url: artUrl,
        headers: headers,
        proxy: options.proxy
    });
    if (credentials && credentials.username) {
        ajaxSettings = _.assign(ajaxSettings, {
            auth: credentials
        });
    }

    var file = fs.createReadStream(filePath);
    if (options.dryRun) {
        file.then(deferred.makeNodeResolver());
    } else {
        file.pipe(request.put(ajaxSettings, function(error, response) {
            if (error) {
                return deferred.reject({
                    message: 'Error making http request: ' + error
                });
            } else if (response.statusCode === 201 /* Created */) {
                return deferred.resolve();
            } else {
                return deferred.reject({
                    message: 'Request received invalid status code: ' + response.statusCode
                });
            }
        }));
    }
    return deferred.promise;
};

function publishFile (filePath, artUrl, options) {
    var parameters = options && options.parameters ? ';' + options.parameters.join(';') : '';

    return generateHashes(filePath).then(function(hashes) {
      var length = fs.statSync(filePath).size;
      var headers = {
        "X-Checksum-Sha1": hashes.sha1,
        "X-Checksum-Md5": hashes.md5,
        "Content-Length": length
      };
      return uploadFile(filePath, artUrl, options, headers);
    });
};

function generateHashes (file) {
    var deferred, md5, sha1, stream;
    deferred = Q.defer();
    md5 = crypto.createHash('md5');
    sha1 = crypto.createHash('sha1');
    stream = fs.ReadStream(file);
    stream.on('data', function(data) {
        sha1.update(data);
        return md5.update(data);
    });
    stream.on('end', function(data) {
        var hashes;
        hashes = {
            md5: md5.digest('hex'),
            sha1: sha1.digest('hex')
        };
        return deferred.resolve(hashes);
    });
    stream.on('error', function(error) {
        return deferred.reject(error);
    });
    return deferred.promise;
};

module.exports = {

    /**
     * Publish a file to Artifactory
     * @param {String} filePath Fully qualified path to a package file (in terms of `fs` module)
     * @param {String} artUrl Fully qualified url of artifact (e.g. 'http://server:8001/myrepo/MyProduct/1.1/Subsystem1/MyProduct.Subsystem1.1.0.0.nupkg')
     * @param {Object} [options]
     * @param {Object} [options.credentials]
     * @param {String} [options.credentials.username] Artifactory user name
     * @param {String} [options.credentials.password] Artifactory user password
     * @param {String} [options.proxy] A proxy url to use for sending http requests
     * @return {Promise} returns a Q promise to be resolved when the artifact is done being published
     */
    publish: function(filePath, artUrl, options) {
        return publishFile(filePath, artUrl, options);
    }

};

/**
* Create a listener for requests to the Appcelerator service broker.
* Any messages prefixed with r: or remote: will be picked up by this listener
*/
 
//Initialize configuration from appcelerator.xml and register listener
swiss.onload(function() {
  
  //Utility function to get a cookie value
  function getCookie(c_name) {
    if (document.cookie.length>0) {
      c_start=document.cookie.indexOf(c_name + "=");
      if (c_start!=-1) { 
        c_start=c_start + c_name.length+1; 
        c_end=document.cookie.indexOf(";",c_start);
        if (c_end==-1) c_end=document.cookie.length;
        return unescape(document.cookie.substring(c_start,c_end));
      } 
    }
    return "";
  };
  
  //Initialize the service broker
  if (window.location.href.indexOf("file://") !== 0) {
    try {
      //load configuration from appcelerator.xml
      swiss.ajax({
        type: 'GET',
        url: "./appcelerator.xml",
        success: function(data){
		   var sbe = data.getElementsByTagName('servicebroker')[0];
          if (sbe.getAttribute('disabled')!='true')
          {
              App.mq.sbconfig.url = sbe.childNodes[0].nodeValue.replace(/@{rootPath}/,"./");
              App.mq.sbconfig.cookieName = data.getElementsByTagName('sessionid')[0].childNodes[0].nodeValue;
              swiss.ajax({
                type: 'GET',
                url: App.mq.sbconfig.url+"?initial=1",
                success: function(data){
                  App.mq.sbconfig.sessionId = getCookie(App.mq.sbconfig.cookieName);
                  App.mq.sbconfig.authToken = App.mq.md5.hex_md5(App.mq.sbconfig.sessionId+App.mq.sbconfig.instanceId);
                },
                error: function(xhr) {
                  $MQ({
                    name: "service.broker.config.fetch.error",
                    payload: swiss.unfilterJSON(xhr.responseText)
                  });
                }
              });
          }
        },
        error: function(xhr) {
          $MQ({
            name: "service.broker.initialization.error",
            payload: swiss.unfilterJSON(xhr.responseText)
          });
        }
      });
    } catch(e) {
      $MQ({
        name: "service.broker.initialization.error",
        payload: e
      });
    }
  }
 
  //Subscribe to remote messages prefixed with r: or remote:
  $MQL(/r:.*|remote:.*/, function(msg) {
    if (msg.appcRemoteResponse || window.location.href.indexOf("file://") == 0) {
      return; //return if this is a response message or this is a local URL
    }
    
    try {    
      //Construct the necessary query parameters
      var parameters = "?maxwait=99999&instanceid="+App.mq.sbconfig.instanceId+'&auth='+App.mq.sbconfig.authToken+'&ts='+new Date().getTime();
      
      //wrap the JSON payload for the request
      var json = {};
      var time = new Date();
      json['timestamp'] = time.getTime()  + (time.getTimezoneOffset()*60*1000);
      json['version'] = '1.0';
      json['messages'] = [];
      //wrap the payload
      var formattedMessage = {
        type: msg.name.replace(/r:|remote:/,""),
        scope: msg.scope,
        version: msg.version||"1.0",
        data: msg.payload
      };
      json['messages'].push(formattedMessage);
      
      //Make an ajax call to the Appcelerator service broker
      swiss.ajax({
        method:'POST',
        url: App.mq.sbconfig.url+parameters,
        data: swiss.toJSON(json),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        success: function(data) {
          data = swiss.evalJSON(data);
          var msgPrefix = (msg.name.indexOf("remote:")!=-1) ? "remote:" : "r:";
          var newMsg = {
            appcRemoteResponse: true,
            name: msgPrefix+data.messages[0].type,
            scope: data.messages[0].scope,
            payload: data.messages[0].data
          };
          $MQ(newMsg);
        },
        error: function(xhr) {
          $MQ({
            name: "service.invocation.error",
            payload: swiss.unfilterJSON(xhr.responseText)
          });
        }
      });
    } catch(e) {
      $MQ({
        name: "service.broker.listener.error",
        payload: e
      });
    }
  }, { msg_scope: 'appcelerator', handle: 'appc.remote.message.listener' });
});
 
//The crap we need to make a call to the service broker
App.mq.sbconfig = {
  url: null,
  cookieName: null,
  sessionId: null,
  instanceId: Math.round(9999*Math.random()) + '-' + Math.round(999*Math.random()),
  authToken: null
};
 
/* MD5 Encoding utility required to communicate with service broker */
App.mq.md5 = 
{
  hexcase: 0,  /* hex output format. 0 - lowercase; 1 - uppercase        */
  b64pad: "",  /* base-64 pad character. "=" for strict RFC compliance   */
  chrsz: 8,    /* bits per input character. 8 - ASCII; 16 - Unicode      */
 
  /*
   * These are the functions you'll usually want to call
   * They take string arguments and return either hex or base-64 encoded strings
   */
  hex_md5: function (s){ return this.binl2hex(this.core_md5(this.str2binl(s), s.length * this.chrsz));},
  b64_md5: function(s){ return this.binl2b64(this.core_md5(this.str2binl(s), s.length * this.chrsz));},
  str_md5: function(s){ return this.binl2str(this.core_md5(this.str2binl(s), s.length * this.chrsz));},
  hex_hmac_md5: function(key, data) { return this.binl2hex(this.core_hmac_md5(key, data)); },
  b64_hmac_md5: function(key, data) { return this.binl2b64(this.core_hmac_md5(key, data)); },
  str_hmac_md5: function(key, data) { return this.binl2str(this.core_hmac_md5(key, data)); },
 
  /*
   * Perform a simple self-test to see if the VM is working
   */
  md5_vm_test:function()
  {
    return this.hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
  },
 
  /*
   * Calculate the MD5 of an array of little-endian words, and a bit length
   */
  core_md5: function(x, len)
  {
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
 
    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;
 
    for(var i = 0; i < x.length; i += 16)
    {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;
 
      a = this.md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
      d = this.md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
      c = this.md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
      b = this.md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
      a = this.md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
      d = this.md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
      c = this.md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
      b = this.md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
      a = this.md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
      d = this.md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
      c = this.md5_ff(c, d, a, b, x[i+10], 17, -42063);
      b = this.md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
      a = this.md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
      d = this.md5_ff(d, a, b, c, x[i+13], 12, -40341101);
      c = this.md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
      b = this.md5_ff(b, c, d, a, x[i+15], 22,  1236535329);
 
      a = this.md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
      d = this.md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
      c = this.md5_gg(c, d, a, b, x[i+11], 14,  643717713);
      b = this.md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
      a = this.md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
      d = this.md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
      c = this.md5_gg(c, d, a, b, x[i+15], 14, -660478335);
      b = this.md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
      a = this.md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
      d = this.md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
      c = this.md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
      b = this.md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
      a = this.md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
      d = this.md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
      c = this.md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
      b = this.md5_gg(b, c, d, a, x[i+12], 20, -1926607734);
 
      a = this.md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
      d = this.md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
      c = this.md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
      b = this.md5_hh(b, c, d, a, x[i+14], 23, -35309556);
      a = this.md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
      d = this.md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
      c = this.md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
      b = this.md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
      a = this.md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
      d = this.md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
      c = this.md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
      b = this.md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
      a = this.md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
      d = this.md5_hh(d, a, b, c, x[i+12], 11, -421815835);
      c = this.md5_hh(c, d, a, b, x[i+15], 16,  530742520);
      b = this.md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);
 
      a = this.md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
      d = this.md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
      c = this.md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
      b = this.md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
      a = this.md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
      d = this.md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
      c = this.md5_ii(c, d, a, b, x[i+10], 15, -1051523);
      b = this.md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
      a = this.md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
      d = this.md5_ii(d, a, b, c, x[i+15], 10, -30611744);
      c = this.md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
      b = this.md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
      a = this.md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
      d = this.md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
      c = this.md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
      b = this.md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);
 
      a = this.safe_add(a, olda);
      b = this.safe_add(b, oldb);
      c = this.safe_add(c, oldc);
      d = this.safe_add(d, oldd);
    }
    return Array(a, b, c, d);
 
  },
 
  /*
   * These functions implement the four basic operations the algorithm uses.
   */
  md5_cmn: function(q, a, b, x, s, t)
  {
    return this.safe_add(this.bit_rol(this.safe_add(this.safe_add(a, q), this.safe_add(x, t)), s),b);
  },
 
  md5_ff: function (a, b, c, d, x, s, t)
  {
    return this.md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
  },
 
  md5_gg: function (a, b, c, d, x, s, t)
  {
    return this.md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
  },
 
    md5_hh: function(a, b, c, d, x, s, t)
  {
    return this.md5_cmn(b ^ c ^ d, a, b, x, s, t);
  },
 
  md5_ii: function (a, b, c, d, x, s, t)
  {
    return this.md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
  },
 
  /*
   * Calculate the HMAC-MD5, of a key and some data
   */
  core_hmac_md5: function (key, data)
  {
    var bkey = this.str2binl(key);
    if(bkey.length > 16)
    {
       bkey = this.core_md5(bkey, key.length * this.chrsz);
    }
 
    var ipad = Array(16), opad = Array(16);
    for(var i = 0; i < 16; i++)
    {
      ipad[i] = bkey[i] ^ 0x36363636;
      opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }
 
    var hash = this.core_md5(ipad.concat(this.str2binl(data)), 512 + data.length * this.chrsz);
    return this.core_md5(opad.concat(hash), 512 + 128);
  },
 
  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   */
  safe_add: function (x, y)
  {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  },
 
  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  bit_rol: function (num, cnt)
  {
    return (num << cnt) | (num >>> (32 - cnt));
  },
 
  /*
   * Convert a string to an array of little-endian words
   * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
   */
  str2binl: function (str)
  {
    var bin = Array();
    var mask = (1 << this.chrsz) - 1;
    for(var i = 0; i < str.length * this.chrsz; i += this.chrsz)
      bin[i>>5] |= (str.charCodeAt(i / this.chrsz) & mask) << (i%32);
    return bin;
  },
 
  /*
   * Convert an array of little-endian words to a string
   */
  binl2str: function (bin)
  {
    var str = "";
    var mask = (1 << this.chrsz) - 1;
    for(var i = 0; i < bin.length * 32; i += this.chrsz)
      str += String.fromCharCode((bin[i>>5] >>> (i % 32)) & mask);
    return str;
  },
 
  /*
   * Convert an array of little-endian words to a hex string.
   */
  binl2hex: function (binarray)
  {
    var hex_tab = this.hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i++)
    {
      str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
             hex_tab.charAt((binarray[i>>2] >> ((i%4)*8  )) & 0xF);
    }
    return str;
  },
 
  /*
   * Convert an array of little-endian words to a base-64 string
   */
  binl2b64: function (binarray)
  {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    for(var i = 0; i < binarray.length * 4; i += 3)
    {
      var triplet = (((binarray[i   >> 2] >> 8 * ( i   %4)) & 0xFF) << 16)
                  | (((binarray[i+1 >> 2] >> 8 * ((i+1)%4)) & 0xFF) << 8 )
                  |  ((binarray[i+2 >> 2] >> 8 * ((i+2)%4)) & 0xFF);
      for(var j = 0; j < 4; j++)
      {
        if(i * 8 + j * 6 > binarray.length * 32) 
        {
           str += this.b64pad;
        }
        else 
        {
           str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
        }
      }
    }
    return str;
  }
 
};
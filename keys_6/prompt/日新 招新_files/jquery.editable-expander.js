/**
 * TextAreaExpander plugin for jQuery
 * v1.0
 * Expands or contracts a textarea height depending on the
 * quatity of content entered by the user in the box.
 *
 * By Craig Buckler, Optimalworks.net
 *
 * As featured on SitePoint.com:
 * http://www.sitepoint.com/blogs/2009/07/29/build-auto-expanding-textarea-1/
 *
 * Please use as you wish at your own risk.
 */

/**
 * Usage:
 *
 * From JavaScript, use:
 *     $(<node>).TextAreaExpander(<minHeight>, <maxHeight>);
 *     where:
 *       <node> is the DOM node selector, e.g. "textarea"
 *       <minHeight> is the minimum textarea height in pixels (optional)
 *       <maxHeight> is the maximum textarea height in pixels (optional)
 *
 * Alternatively, in you HTML:
 *     Assign a class of "expand" to any <textarea> tag.
 *     e.g. <textarea name="textarea1" rows="3" cols="40" class="expand"></textarea>
 *
 *     Or assign a class of "expandMIN-MAX" to set the <textarea> minimum and maximum height.
 *     e.g. <textarea name="textarea1" rows="3" cols="40" class="expand50-200"></textarea>
 *     The textarea will use an appropriate height between 50 and 200 pixels.
 */

(function($) {

	// jQuery plugin definition
	$.fn.TextAreaExpander = function(minHeight, maxHeight) {
		var _this = this;

		var browser = (function(){
		    var ua= navigator.userAgent, tem, 
		    M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*([\d\.]+)/i) || [];
		    if(/trident/i.test(M[1])){
		        tem=  /\brv[ :]+(\d+(\.\d+)?)/g.exec(ua) || [];
		        return 'IE '+(tem[1] || '');
		    }
		    M= M[2]? [M[1], M[2]]:[navigator.appName, navigator.appVersion, '-?'];
		    if((tem= ua.match(/version\/([\.\d]+)/i))!= null) M[2]= tem[1];
		    return M.join(' ');
		})().toLowerCase();

		//the original detection method is using $.browser
		//var hCheck = !($.browser.msie || $.browser.opera);
		var hCheck = !( browser.indexOf("ie") > 0 || browser.indexOf("opera") > 0);

		// resize a textarea
		function ResizeDiv(e) {
			// is a editable div or textarea?
			if ( (!this.nodeName || this.nodeName.toLowerCase() != "div" || !$(this).hasClass("editable")) &&  (!this.nodeName || this.nodeName.toLowerCase() != "textarea") ) return;

			// set height restrictions
			var p = this.className.match(/expand(\d+)\-*(\d+)*/i);
			this.expandMin = minHeight || (p ? parseInt('0'+p[1], 10) : 0);
			this.expandMax = maxHeight || (p ? parseInt('0'+p[2], 10) : 999);

			// event or initialize element?
			e = e.target || e;

			// find content length and box width
			if(e.nodeName.toLowerCase() == "textarea"){
			 	var vlen = e.value.length, ewidth = e.offsetWidth;
			}else{
				var vlen = e.innerHTML.length, ewidth = e.offsetWidth;
			}
			if (vlen != e.valLength || ewidth != e.boxWidth) {
				if (hCheck && (vlen < e.valLength || ewidth != e.boxWidth)) e.style.height = "0px";
				
				var h = Math.max(e.expandMin, Math.min(e.scrollHeight, e.expandMax));
				
				e.style.overflow = (e.scrollHeight > h ? "auto" : "hidden");
				e.style.height = h + "px";
				e.valLength = vlen;
				e.boxWidth = ewidth;
			}

			return true;
		};

		// initialize
		this.each(function() {

			// is a editable div or textarea?
			if ( (!this.nodeName || this.nodeName.toLowerCase() != "div" || !$(this).hasClass("editable")) &&  (!this.nodeName || this.nodeName.toLowerCase() != "textarea") ) return;

			// set height restrictions
			var p = this.className.match(/expand(\d+)\-*(\d+)*/i);
			this.expandMin = minHeight || (p ? parseInt('0'+p[1], 10) : 0);
			this.expandMax = maxHeight || (p ? parseInt('0'+p[2], 10) : 99999);

			// initial resize
			ResizeDiv(this);

			// zero vertical padding and add events
			if (!this.Initialized) {
				this.Initialized = true;
				$(this).css("padding-top", 0).css("padding-bottom", 0);
				$(document).on("keyup",_this.selector, ResizeDiv);//.on("focus",_this.selector, ResizeTextarea);
			}
		});

		return this;
	};

})(jQuery);

// initialize all expanding textareas
jQuery(document).ready(function() {
	jQuery("div.editable[class*=expand],textarea[class*=expand]").TextAreaExpander();
});

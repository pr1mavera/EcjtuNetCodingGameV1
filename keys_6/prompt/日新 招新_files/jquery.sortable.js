jQuery.fn.sortable = function(custom_options,callback){
	//this includes all the els and context and selector
	var _this = this,
		mousedown = false,
		move_token = null,
		borderWidth = 1,
		borderColor = "orange",
		currentEl = null,
		startmouse = {},
		currentmouse = {},
		diff = {},
		$clone = null,
		options = {banzone : null,trigger : null,sortdata : "order",itemdata : "cid",datael : "",axi:"y"},
		elzIndex,
		elHeight = 0,
		elWidth = 0,
		elLeft = elTop = 0;
		callback = $.isFunction(callback) ? callback : function(){};
		this.addClass("sortable");

		var isTouchSupported = 'ontouchstart' in window;
		var isPointerSupported = navigator.pointerEnabled;
		var isMSPointerSupported =  navigator.msPointerEnabled;
		var downEvent = isTouchSupported ? 'touchstart' : (isPointerSupported ? 'pointerdown' : (isMSPointerSupported ? 'MSPointerDown' : 'mousedown'));
		var moveEvent = isTouchSupported ? 'touchmove' : (isPointerSupported ? 'pointermove' : (isMSPointerSupported ? 'MSPointerMove' : 'mousemove'));
		var upEvent = isTouchSupported ? 'touchend' : (isPointerSupported ? 'pointerup' : (isMSPointerSupported ? 'MSPointerUp' : 'mouseup'));
		$.extend(options,custom_options);

		if(options.banzone){
			if($.type(options.banzone) == "string"){
				this.find(options.banzone).addClass("unselectable");
			}else if($.type(options.banzone) == "object"){
				$(options.banzone).addClass("unselectable");
			}
		}

		if(options.trigger){
			if($.type(options.trigger) == "string"){
				this.find(options.trigger).addClass("sort_trigger").css({cursor:"move"});
			}else if($.type(options.trigger) == "object"){
				$(options.trigger).addClass("sort_trigger").css({cursor:"move"});
			}
		}else{
			this.css({cursor:"ns-resize"});
		}

	// if(isTouchSupported){
	// 	document.addEventListener("touchstart",function(e){
	// 		document.title = event.touches[0].pageX;
	// 	},false);
	// }

	$(document).on(downEvent+".sortable",_this.selector,function(event){
		event = event.originalEvent;
		var target = event.target || event.srcElement;

		if((options.trigger && !$(target).hasClass("unselectable") && $(target).hasClass("sort_trigger")) || (!options.trigger && !$(target).hasClass("unselectable"))){
			if($(_this.selector).length < 2){
				return false;
			}

			if($(".sortable.hidden").length > 0 && $(".sortholder").length > 0){
				if(mousedown){
					mousedown = false;
					$(currentEl).insertBefore($(".sortholder").get(0)).show().removeClass("hidden");
					
					$(".sortholder").remove();
					$clone.remove();
					$clone = null;
				}
				return false;
			}

			if((event.button && event.button == "2") || !$(this).hasClass("sortable")){
				return false;
			}

			mousedown = true;

			if(move_token == null){
				move_token = Date.now();
				$(document).on(moveEvent+"."+move_token,onmousemove);
			}

			if(isTouchSupported && event.touches.length > 0){
				startmouse.x = event.touches[0].pageX;
				startmouse.y = event.touches[0].pageY;
			}else{
				startmouse.x = event.pageX || event.clientX;
				startmouse.y = event.pageY || event.clientY;
			}
			

			currentEl = this;
			elzIndex = $(currentEl).css("z-index");
			elWidth = $(this).outerWidth()-borderWidth*2;
			elHeight = $(this).outerHeight()-borderWidth*2;
			elLeft = $(currentEl).offset().left;
			elTop = $(currentEl).offset().top;
			diff.x = (startmouse.x - elLeft);
			diff.y = (startmouse.y - elTop);

			$clone = $(currentEl).clone();
			$(this).after("<div class=\"sortholder\"></div>");
			$(".sortholder").css({width:elWidth+"px",height:elHeight+"px",margin:$(currentEl).css("margin"),border:borderWidth+"px dashed "+borderColor,left:elLeft+"px",top:elTop+"px"});

			$(currentEl).addClass("hidden").css("z-index",999).hide();
			
			$(currentEl).after($clone.css({opacity:".5",position:"absolute",left:elLeft+"px",top:elTop+"px",width:elWidth+"px",height:elHeight+"px"}).addClass("clone").show().get(0));
			
			if(event.preventDefault){
				event.preventDefault();
			}else{
				event.returnValue = false;
			}
			
		}

		
	});
	
	var onmousemove = function(event){
		event = event.originalEvent;
		var target = event.target || event.srcElement;
		if((event.button && event.button == "2")){
			return false;
		}

		if(mousedown){
			if(event.preventDefault){
				event.preventDefault();
			}else{
				event.returnValue = false;
			}

			
			if(isTouchSupported && event.touches.length > 0){
				currentmouse.x = event.touches[0].pageX;
				currentmouse.y = event.touches[0].pageY;
			}else{
				currentmouse.x = event.pageX || event.clientX;
				currentmouse.y = event.pageY || event.clientY;
			}

			var left = currentmouse.x - diff.x,
				top = currentmouse.y - diff.y,
				tempDiv = $(".sortholder");

			if(options.axi == "y"){
				$clone.css({opacity:".5",position:"absolute",left:elLeft+"px",top:top+"px",display:"block"});
			}else if(options.axi == "x"){
				$clone.css({opacity:".5",position:"absolute",left:left+"px",top:elTop+"px",display:"block"});
			}else if(options.axi == "xy"){
				$clone.css({opacity:".5",position:"absolute",left:left+"px",top:top+"px",display:"block"});
			}
			
			$(_this.selector).not(".hidden").each(function(){
				var $targetFirst = $(_this.selector).not(".hidden").first();

				if(options.axi == "y"){
					//对于在拖动元素下面的元素
					if(elTop < $(this).offset().top){
						if (top >= $(this).offset().top - elHeight/2 && top <= $(this).offset().top - elHeight/2 + $(this).height()) {
							if(!!options.datael){
								tempDiv.data(options.sortdata,$(options.datael,this).data(options.sortdata))
								.data(options.itemdata,$(options.datael,this).data(options.itemdata));
							}else{
								tempDiv.data(options.sortdata,$(this).data(options.sortdata))
								.data(options.itemdata,$(this).data(options.itemdata));
							}
							
							tempDiv.insertAfter(this);
						}
					}
					
					//对于在拖动元素上面的元素
					if(elTop > $(this).offset().top){
						if((top <= $(this).offset().top + elHeight/2 && top > $(this).offset().top)){
							if(!!options.datael){
								tempDiv.data(options.sortdata,$(options.datael,this).data(options.sortdata))
								.data(options.itemdata,$(options.datael,this).data(options.itemdata));
							}else{
								tempDiv.data(options.sortdata,$(this).data(options.sortdata))
								.data(options.itemdata,$(this).data(options.itemdata));
							}
							
							tempDiv.insertBefore(this);
						}
					}
				}else if(options.axi == "x"){
					
				}
			});
		}
	};


	$(document).on(upEvent+".sortable",function(event){
		var event = event || window.event;
		var target = event.target || event.srcElement;
		if((event.button && event.button == "2")){
			return false;
		}

		if(mousedown){
			mousedown = false;
			if(move_token != null){
				$(document).off(moveEvent+"."+move_token);
			}
			move_token = null;

			$(currentEl).insertBefore($(".sortholder").get(0)).show().removeClass("hidden").css("z-index",elzIndex);
			
			$clone.remove();
			$clone = null;

			var itemsort = "";
			$(_this.selector).each(function(){
				itemsort += !!$(options.datael,this).data(options.itemdata) ? $(options.datael,this).data(options.itemdata)+"|" : (!!$(this).data(options.itemdata) ? $(this).data(options.itemdata)+"|" : "");
			});

			var data = {
				srcdata : {},
				dstdata : {},
				itemsort : itemsort.replace(/\|$/,"")
			};
			if(!!options.datael){
				data.srcdata[options.sortdata] = $(options.datael,currentEl).data(options.sortdata);
				data.srcdata[options.itemdata] = $(options.datael,currentEl).data(options.itemdata);
			}else{
				data.srcdata[options.sortdata] = $(currentEl).data(options.sortdata);
				data.srcdata[options.itemdata] = $(currentEl).data(options.itemdata);
			}
			
			data.dstdata[options.sortdata] = $(".sortholder").data(options.sortdata);
			data.dstdata[options.itemdata] = $(".sortholder").data(options.itemdata);
			$(".sortholder").remove();
			callback.call(_this,data);
			if(event.preventDefault){
				event.preventDefault();
			}else{
				event.returnValue = false;
			}
		}
	})
};

jQuery.dragdrop = function(custom_options,callback){
	var options = {draggable:[".folder","li.bm",".tag-con"],exclude:[],droppable:["#bm_cons","#wrapper"],trigger:null,banzone:"",disable_drag:"a"},
		$clone = null,
		mousedown = false,
		draggable_els = "",
		droppable_els = "",
		disable_drag_els = "",
		exclude_els = "",
		startmouse = {},
		currentmouse = {},
		diff = {},
		currentEl = null,
		elClass = "",
		elLeft = 0,
		elTop = 0,
		elParent = null,
		elParentStr = "",
		targetDropZone = new Array(),
		targetSelector = "",
		borderWidth = 1;
	$.extend(options,custom_options);

	if(!!options.banzone){
		$(options.banzone).addClass("undraggable");
	}

	if($.isArray(options.draggable)){
		if(options.draggable.length == 1){
			draggable_els = options.draggable[0];
			disable_drag_els = draggable_els+" "+options.disable_drag;
			exclude_els = draggable_els+""+options.exclude;
		}else{
			draggable_els = options.draggable.join(",");
			disable_drag_els = options.draggable.join(" "+options.disable_drag+",")+" "+options.disable_drag;
			exclude_els = options.draggable.join(options.exclude+",")+""+options.exclude;
		}
	}else{
		draggable_els = options.draggable;
		disable_drag_els = draggable_els+" "+options.disable_drag;
		exclude_els = draggable_els+""+options.exclude;
	}

	if($.isArray(options.droppable)){
		if(options.droppable.length == 1){
			droppable_els = options.droppable[0];
		}else{
			droppable_els = options.droppable.join(",");
		}
	}else{
		droppable_els = options.droppable;
	}
	
	if(!!options.trigger){
		$(draggable_els).find(options.trigger).addClass("drag_trigger")
	}
	
	if(options.disable_drag){
		//disable browser's native drag drop functionality
		$(document).on("dragstart.dragdrop", disable_drag_els,function() {
	     	return false;
		});
	}

	if(!!options.exclude){
		$(exclude_els).addClass("undraggable");
	}
	

	//then they can be drag around, and we need no placeholder here
	$(document).on("mousedown.dragdrop",draggable_els,function(event){
		event = event || window.event;
		if(event.stopPropagation){
			event.stopPropagation();
		}else if(event.cancelBuble){
			event.cancelBuble = true;
		}
		var target = event.target || event.srcElement;

		if((event.button && event.button == "2") || $(droppable_els).length <= 0 || $(target).hasClass("undraggable") || $(this).hasClass("undraggable")){
			return false;
		}

		if((options.trigger && $(target).hasClass("drag_trigger")) || (!options.trigger)){
			currentEl = this;
			if(!currentEl){
				return false;
			}
			mousedown = true;
			startmouse.x = event.pageX || event.clientX;
			startmouse.y = event.pageY || event.clientY;
			//get el parent
			var droppable = options.droppable;
			
			for(var i=0,len=droppable.length; i<len; i++){
				var container = $(droppable[i]).get(0);
				if($.contains(container,currentEl)){
					elParent = container;
					elParentStr = droppable[i];
				}else{
					targetDropZone.push(droppable[i]);
				}
			}

			if(targetDropZone.length > 0){
				if(targetDropZone.length == 1){
					targetSelector = targetDropZone[0];
				}else{
					targetSelector = targetDropZone.join(",");
				}
			}

			elVis = currentEl.style.visibility;
			elWidth = $(this).outerWidth()-borderWidth*2;
			elHeight = $(this).outerHeight()-borderWidth*2;
			elLeft = $(currentEl).offset().left;
			elTop = $(currentEl).offset().top;
			diff.x = (startmouse.x - elLeft);
			diff.y = (startmouse.y - elTop);

			$clone = $(currentEl).clone();
			currentEl.style.visibility = "hidden";
			$(currentEl).after($clone.css({opacity:".5","z-index":999,position:"absolute",left:elLeft+"px",top:elTop+"px",width:elWidth+"px",height:elHeight+"px"}).addClass("clone").show().get(0));	
		}
	});

	$(document).on("mousemove.dragdrop",function(event){
		event = event || window.event;
		var target = event.target || event.srcElement;

		if(mousedown){
			if(event.preventDefault){
				event.preventDefault();
			}else{
				event.returnValue = false;
			}
			$(currentEl).addClass("dragging");

			currentmouse.x = event.pageX || event.clientX;
			currentmouse.y = event.pageY || event.clientY;
			var left = currentmouse.x - diff.x,
				top = currentmouse.y - diff.y;
				
			$clone.css({left:left+"px",top:top+"px"});

			$(targetSelector).each(function(){
				var conWidth = $(this).width();
				var conHeight = $(this).height();
				var conTop = $(this).offset().top;
				var conLeft = $(this).offset().left;

				if(currentmouse.y  > conTop && currentmouse.y < conTop+conHeight && currentmouse.x  > conLeft && currentmouse.x  < conLeft+conWidth){
					this.style.outline = "2px dashed orange";
					$(this).addClass("droparea");
				}else{
					this.style.outline = "none";
					$(this).removeClass("droparea");
				}
			});
		}
	});

	$(document).on("mouseup.dragdrop",function(event){
		event = event || window.event;

		var target = event.target || event.srcElement;
		if((event.button && event.button == "2")){
			return false;
		}

		if(mousedown && currentEl){
			currentEl.style.visibility = elVis;
			
			$clone.remove();

			$(currentEl).removeClass("dragging");
			$(targetSelector).css("outline","none");

			if($.isFunction(callback)){
				callback.call(currentEl,$(".droparea").get(0));
			}

			//reset
			mousedown = false;
			currentEl = null;
			targetSelector = "";
			targetDropZone.length = 0;
			$(".droparea").removeClass("droparea");
			$clone = null;
		}
	});
};

jQuery.fn.aloha = function(options){
	var _this = this,
		timeout = null,
		options = options || {},
		leftOffset = options.leftOffset || 0,
		container = options.container || document.body;

	// 鼠标经过时展示tooltip
	$(container).on("mouseover",_this.selector,function(event){
		var text = $(this).data("tooltip") || this.title;
		if(this.title){
			$(this).attr("data-tooltip",this.title);
			this.title = "";
		}

		if(text){
			var template = '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>';
			$(container).append(template);
			var $container = $(".tooltip",container);
			var $text = $container.find(".tooltip-inner");
			$text.text(text);

			//定位
			var position = $(this).data("placement") || "top";

			$container.addClass(position);

			var top = $(this).offset().top;
			var left = $(this).offset().left - ($container.width()/2 - $(this).width()/2);

			if(position == "top"){
				top = top - $container.height() - 10;
			}else if(position == "bottom"){
				top = top + $(this).height();
			}else if(position == "left"){
				left = $(this).offset().left - $container.width() - 10;
				top = top - ($container.height()/2 - $(this).height()/2);
			}else if(position == "right"){
				
			}

			$container.css({top:top+"px",left:left+"px",opacity:1,zIndex:100000});

			$(this).one("mousedown",function(event){
				$(".tooltip",container).remove();
			});
		}
	});

	// 鼠标移出时展示tooltip
	$(container).on("mouseout",_this.selector,function(event){
		$(".tooltip",container).remove();

		if(timeout) clearTimeout(timeout);
	});
};


jQuery.fn.swap_position = function(custom_options,callback){
	var options = {},
		_this = this,

		prev_display = "",
		currentTarget = null,
		targetOffset = null,
		$clonedTarget = null,
		mousedown = false,
		move_token = null,
		currentmouse = {},
		startmouse = {},

		elLeft,elTop,elWidth,elHeight,diff = {},
		isTransformSupported = typeof document.body.style.transform != "undefined",
		isTouchSupported = 'ontouchstart' in window,
		isPointerSupported = navigator.pointerEnabled,
		isMSPointerSupported =  navigator.msPointerEnabled,
		downEvent = isTouchSupported ? 'touchstart' : (isPointerSupported ? 'pointerdown' : (isMSPointerSupported ? 'MSPointerDown' : 'mousedown')),
		moveEvent = isTouchSupported ? 'touchmove' : (isPointerSupported ? 'pointermove' : (isMSPointerSupported ? 'MSPointerMove' : 'mousemove')),
		upEvent = isTouchSupported ? 'touchend' : (isPointerSupported ? 'pointerup' : (isMSPointerSupported ? 'MSPointerUp' : 'mouseup'));
	
	$.extend(options,custom_options);

	$(document).on(downEvent+".swap_position",_this.selector,function(event){
		//被点击的元素
		var trigger = event.target;
		if((event.button && event.button == "2")) return false;
		if(!options.trigger || (options.trigger && $(trigger).hasClass(options.trigger)) ){
			//阻止默认行为
			event.preventDefault();
			oriEvent = event.originalEvent;
			var is_mobile = isTouchSupported && oriEvent.touches.length > 0;

			//记录鼠标位置
			if(is_mobile){
				startmouse.x = oriEvent.touches[0].pageX;
				startmouse.y = oriEvent.touches[0].pageY;
			}else{
				startmouse.x = event.pageX || event.clientX;
				startmouse.y = event.pageY || event.clientY;
			}

			//当前对象
			currentTarget = this;
			targetOffset = $(currentTarget).offset();

			$(currentTarget).addClass("moving").after("<b class='share-item-placeholder' style=''></b>");

			mousedown = true;

			$(_this.selector).each(function(){
				var offset = $(this).offset();
				$(this).data({left:offset.left,top:offset.top});
			});

			if(move_token == null){
				move_token = Date.now();
				$(document).on(moveEvent+"."+move_token,onmousemove);
			}
		}

	});


	var onmousemove = function(event){
		if(mousedown && currentTarget != null){
			oriEvent = event.originalEvent;
			var is_mobile = isTouchSupported && oriEvent.touches.length > 0;

			//记录鼠标位置
			if(is_mobile){
				currentmouse.x = oriEvent.touches[0].pageX;
				currentmouse.y = oriEvent.touches[0].pageY;
			}else{
				currentmouse.x = event.pageX || event.clientX;
				currentmouse.y = event.pageY || event.clientY;
			}

			var offsetX = currentmouse.x - startmouse.x;
			var offsetY = currentmouse.y - startmouse.y;

			if(isTransformSupported){
				currentTarget.style.transform = "translateX("+offsetX+"px) translateY("+offsetY+"px)";
				currentTarget.style.transition = "none";
			}else{
				currentTarget.style.left = offsetX + "px";
				currentTarget.style.top = offsetY + "px";
			}

			var iconLeft,iconTop;
			$(_this.selector).each(function(){
				var iconLeft = $(this).data("left");
				var iconTop = $(this).data("top");
				if(currentmouse.x > iconLeft && currentmouse.x < iconLeft + $(this).width() && currentmouse.y > iconTop && currentmouse.y < iconTop + $(this).height()){
					//样式上给与一些变化
					if(!$(this).hasClass("moving")){
						$(this).addClass("ready_replace");

						var diffx = targetOffset.left - iconLeft;
						var diffy = targetOffset.top - iconTop;

						if(isTransformSupported){
							this.style.transform = "translateX("+diffx+"px) translateY("+diffy+"px)";
						}else{
							this.style.left = diffx + "px";
							this.style.top = diffy + "px";
						}
					}
				}else{
					//还原样式上的变化
					$(this).removeClass("ready_replace");
					if(!$(this).hasClass("moving")) this.style.cssText = "";
				}
			});
		}
	};

	$(document).on(upEvent+".swap_position",function(event){
		if(mousedown && $(".ready_replace").length > 0){

			var drop_left = $(currentTarget).position().left;
			var drop_top = $(currentTarget).position().top + $(currentTarget).offsetParent().scrollTop();

			//替换node
			$(".ready_replace").after(currentTarget);
			
			$(".share-item-placeholder").before($(".ready_replace").removeAttr("style").removeClass("ready_replace").get(0));
			if($.isFunction(callback)){
				callback({
					src_pos:$(currentTarget).data("id"),
					dst_pos:$(".ready_replace").data("id")
				});
			}
		}

		$(_this.selector).each(function(){
			if($(this).hasClass("moving")) $(this).removeClass("moving");
		});

		if(currentTarget){
			currentTarget.style.cssText = "";
		}

		$(".share-item-placeholder").remove();

		mousedown = false;
		if(move_token != null){
			$(document).off(moveEvent+"."+move_token);
		}
		$(currentTarget).removeClass("ready_drop");
		move_token = null;
	});
};







































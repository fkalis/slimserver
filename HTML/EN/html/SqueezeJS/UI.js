// some common components for the player control
SqueezeJS.UI = {
	// add some custom events we'll be using to our base class
	Component : Ext.extend(Ext.Component, {
		initComponent : function(config){
			if (typeof config == 'string')
				config = { el: config };

			Ext.apply(this, config);
			SqueezeJS.UI.Component.superclass.initComponent.call(this);
	
			this.el = Ext.get(this.el);
	
			// subscribe to some default events
			SqueezeJS.Controller.on({
				'playlistchange': {
					fn: this.onPlaylistChange,
					scope: this
				},
				'playerstatechange': {
					fn: this.onPlayerStateChange,
					scope: this
				}
			});
		},

		onPlaylistChange : function(){},
		onPlayerStateChange : function(){}
	}),

	// graphical button, defined in three element sprite for normal, mouseover, pressed
	Button : Ext.extend(Ext.Button, {
		power: 0,
		cmd : null,
		cmd_id : null,
		cls : '',
	
		initComponent : function(){
			this.tooltipType = this.initialConfig.tooltipType || 'title';

			if (this.initialConfig.template)
				this.template = this.initialConfig.template;
			else if (SqueezeJS.UI.buttonTemplate)
				this.template = SqueezeJS.UI.buttonTemplate;

			// if we want a pure graphical button, overwrite text and setText method
			if (this.noText) {
				this.text = '';
				this.setText = function(){};
			}

			SqueezeJS.UI.Button.superclass.initComponent.call(this);

			// work around an IE7 workaround...
			if (Ext.isIE7) {
				Ext.apply(this, {
					autoWidth : function(){
						if(this.el){
							this.el.setWidth("auto");
							if(this.minWidth){
								if(this.el.getWidth() < this.minWidth){
									this.el.setWidth(this.minWidth);
								}
							}
						}
					}
				});
			}

			SqueezeJS.Controller.on({
				'playerstatechange': {
					fn: function(result){
						this.power = (result.power == null) || result.power; 
	
						// update custom handler for stations overwriting default behavior
						if (this.cmd_id && result.playlist_loop && result.playlist_loop[0] 
							&& result.playlist_loop[0].buttons && result.playlist_loop[0].buttons[this.cmd_id]) {
				
							var btn = result.playlist_loop[0].buttons[this.cmd_id];
				
							if (btn.cls)
								this.setClass(btn.cls);
							else if (btn.icon)
								this.setIcon(btn.icon);
				
							if (btn.tooltip)
								this.setTooltip(btn.tooltip);

							if (this.textOnly && btn.tooltip)
								this.setText(btn.tooltip);
							
				
							if (btn.command)
								this.cmd = btn.command;
						}
	
						this.onPlayerStateChange(result);
					},
					scope: this
				}
			});

			this.on({
				'render': {
					fn: function() {
						if (this.minWidth) {
							var btnEl = this.el.child("button:first");
							Ext.get(btnEl).setWidth(this.minWidth);
						}
					},
					scope: this
				}
			});
		},
	
		onPlayerStateChange : function(result){},
	
		setTooltip: function(tooltip){
			if (this.tooltip == tooltip)
				return;
	
			this.tooltip = tooltip;

			if (this.textOnly)
				this.setText(this.tooltip);
			
			var btnEl = this.el.child("button:first");
	
			if(typeof this.tooltip == 'object'){
				Ext.QuickTips.tips(Ext.apply({
					target: btnEl.id
				}, this.tooltip));
			} 
			else {
				btnEl.dom[this.tooltipType] = this.tooltip;
			}
		},

		setText : function(text){
			this.text = text;

			if (this.el)
				this.el.child(this.buttonSelector).update(text);

			this.autoWidth();
		},

		setClass: function(newClass) {
			this.el.removeClass(this.cls);
			this.cls = newClass
			this.el.addClass(this.cls);
		},
	
	
		setIcon: function(newIcon) {
			var btnEl = this.el.child("button:first");
			if (btnEl)
				btnEl.setStyle('background-image', newIcon ? 'url(' + webroot + newIcon + ')' : '');
		}
	}),

	Buttons : {}
};


SqueezeJS.UI.ScrollPanel = {
	offset : 0,
	el : null,

	init : function() {
		var el;
		this.offset = 0;

		if (el = Ext.get('infoTab'))
			this.offset += el.getHeight();

		if (el = Ext.get('pageFooterInfo'))
			this.offset += el.getHeight();

		if ((el = Ext.get('browsedbList')) ||
			((el = Ext.get('content')) && el.hasClass('scrollingPanel'))) {

			this.el = el;
			this.offset += this.el.getTop();

			Ext.EventManager.onWindowResize(this.onResize, this);
			this.onResize();
		}
	},

	onResize : function(){
		this.el.setHeight( Ext.fly(document.body).getViewSize().height - this.offset );
	}
};


// specialised TreeLoader to create folder trees
SqueezeJS.UI.FileTreeLoader = function(filter) {
	Ext.apply(this, {
		dataUrl: '/jsonrpc.js',
		filter: filter
	});
	SqueezeJS.UI.FileTreeLoader.superclass.constructor.call(this);	
};

Ext.extend(SqueezeJS.UI.FileTreeLoader, Ext.tree.TreeLoader, {
	getParams: function(node){
		var cliQuery = [ 'readdirectory', 0, 99999 ];

		cliQuery.push("folder:" + node.id);

		if (this.filter)
			cliQuery.push("filter:" + this.filter);

		return Ext.util.JSON.encode({ 
			id: 1,
			method: "slim.request",
			params: [ "", cliQuery ]
		});
	},

	createNode : function(attr){
		Ext.apply(attr, {
			id: attr.path,
			text: attr.name,
			leaf: (!attr.isfolder > 0),
			iconCls: (attr.isfolder > 0 ? 'x-tree-node-alwayscollapsed' : '')
		});

		return SqueezeJS.UI.FileTreeLoader.superclass.createNode.call(this, attr);
	},

	// we have to extract the result ourselves as IE/Opera can't handle multi-node data roots
	processResponse : function(response, node, callback){
		try {
			var o = eval("(" + response.responseText + ")");
			o = eval('o.result');

			SqueezeJS.UI.FileTreeLoader.superclass.processResponse.call(
				this, { responseText: Ext.util.JSON.encode(o.fsitems_loop) }, node, callback);
		} catch(e){
			this.handleFailure(response);
		}
	}
});


// the FileSelector panel component
SqueezeJS.UI.FileSelector = Ext.extend(Ext.tree.TreePanel, {
	initComponent : function(config){
		Ext.apply(this, config);

		Ext.apply(this, {
			rootVisible: false,
			animate: false,
			pathSeparator: '|',
			containerScroll: true,
			loader: new SqueezeJS.UI.FileTreeLoader(this.filter),
			root: new Ext.tree.AsyncTreeNode({
				text: 'root',
				id: '/'
			})
		});

		SqueezeJS.UI.FileSelector.superclass.initComponent.call(this);

		this.on({
			click: this.onClick,
			collapse: this.onCollapse
		});

		this.selectMyPath();	

		// activate button to add path to the selector box
		var gotoBtn;
		if (this.gotoBtn && (gotoBtn = Ext.get(this.gotoBtn))) {
			new Ext.Button({
				renderTo: gotoBtn,
				text: '>',
				handler: this.showPath,
				scope: this
			});
		}
	},

	onClick: function(node, e){
		var input = Ext.get(this.input);
		if (input != null && input.dom.value != null) {
			input.dom.value = node.id;
		}
	},

	// clean up collapsed nodes so we can refresh a view
	onCollapse: function(node){
		while(node.firstChild){
			node.removeChild(node.firstChild);
		}

		node.childrenRendered = false;
		node.loaded = false;

		// add dummy node to prevent file icon instead of folder
		node.appendChild([]);
	},

	selectMyPath: function(){
		// select the current setting, if available
		var input = Ext.get(this.input);

		if (input == null || input.dom.value == null || input.dom.value == '')
			return;

		var path = input.dom.value;
		var separator = '/';
		var result;

		if (path.match(/^[a-z]:\\/i))
			separator = '\\';

		// only open the first level of UNC paths (\\server\share)
		else if (result = path.match(/^\\\\[\_\w\-]+\\[\-\_\w ]+[^\\]/))
			path = result[0];

		path = path.split(separator);

		var prev = '';
		var target = this.pathSeparator + this.root.id;

		// we don't need the root element on *X systems, but on Windows...
		for (var x=(path[0]=='/' ? 1 : 0); x<path.length; x++) {
			if (path[x] == '') continue;

			prev += (x==0 ? '' : separator) + path[x];
			target += this.pathSeparator + prev;
		}

		this.selectPath(target, null, function(success, selNode){
			if (!success) {
				// if that path is a Windows share, try adding it to the tree
				var result = input.dom.value.match(/^\\\\[\_\w\-]+\\[\-\_\w ]+[^\\]/);
				if (result) {
					var root = this.getRootNode();
					root.appendChild(new Ext.tree.AsyncTreeNode({
						id: result[0],
						text: result[0],
						iconCls: 'x-tree-node-alwayscollapsed'
					}));
					this.selectMyPath();
				}
			}
		}.createDelegate(this));
	},

	// select path (if available) or try to add it to the tree if it's a network share
	showPath: function(){
		var input = Ext.get(this.input);
		if (input == null || input.dom.value == null)
			return;

		SqueezeJS.Controller.request({
			params: ["",
				[
					'pref',
					'validate',
					'audiodir',
					input.dom.value
				]
			],

			scope: this,

			success: function(response, options){
				var result = Ext.util.JSON.decode(response.responseText);

				if (result.result.valid == '1')
					this.selectMyPath();

				else
					input.highlight('#ff8888');

			}
		});
	}
});


// menu highlighter helper classes 
SqueezeJS.UI.Highlight = function(config){
	this.init();
};

SqueezeJS.UI.Highlight.prototype = {
	highlightedEl : null,
	unHighlightTimer : null,
	isDragging : false,

	init : function() {
		// make sure all selectable list items have a unique ID
		var items = Ext.DomQuery.select('.selectorMarker');
		for(var i = 0; i < items.length; i++) {
			Ext.id(Ext.get(items[i]));
		}

		if (!this.unHighlightTimer)
			this.unHighlightTimer = new Ext.util.DelayedTask(this.unHighlight, this);

		// don't remove the highlight automatically while we're editing a search term or similar
		Ext.select('.browsedbControls input[type="text"]').on({
			focus: this.unHighlightTimer.cancel,
			click: this.unHighlightTimer.cancel
		});
	},

	highlight : function(target, onClickCB){
		// don't highlight while dragging elements around
		if (this.isDragging)
			return;

		// return if the target is a child of the main selector
		var el = Ext.get(target.id); 
		if (el == this.highlightedEl)
			return;

		// always highlight the main selector, not its children
		if (el != null) {
			this.unHighlight();
			this.highlightedEl = el;
			this.unHighlightTimer.delay(2000);

			el.replaceClass('selectorMarker', 'mouseOver');

			this.highlightedEl.onClickCB = onClickCB || this.onSelectorClicked;
			el.on('click', this.highlightedEl.onClickCB);
		}
	},

	unHighlight : function(){
		// remove highlighting from the other DIVs
		if (this.highlightedEl) {
			this.highlightedEl.replaceClass('mouseOver', 'selectorMarker');
			this.highlightedEl.un('click', this.highlightedEl.onClickCB);
			this.highlightedEl = null;
		}
	},

	onSelectorClicked : function(ev, target){
		target = Ext.get(target);
		if (target.hasClass('browseItemDetail') || target.hasClass('playlistSongDetail'))
			target = Ext.get(target.findParentNode('div'));

		var el = target.child('a.browseItemLink');
		if (el && el.dom.href) {
			if (el.dom.target) {
				try { parent.frames[el.dom.target].location.href = el.dom.href; }
				catch(e) { location.href = el.dom.href; }
			}
			else {
				location.href = el.dom.href;
			}
		}
	}
}

// create d'n'd sortable panel
SqueezeJS.UI.Sortable = function(config){
	Ext.apply(this, config);

	Ext.dd.ScrollManager.register(this.el);

	this.init();
};

SqueezeJS.UI.Sortable.prototype = {
	init: function(){
		var items = Ext.DomQuery.select(this.selector);
		this.offset |= 0;

		for(var i = 0; i < items.length; i++) {
			var item = Ext.get(items[i]);

			if (!item.hasClass('dontdrag'))
				item.dd = new SqueezeJS.DDProxy(items[i], this.el, {
					position: i + this.offset,
					list: this
				});
		}

		if (this.highlighter)
			this.highlighter.isDragging = false;
	},

	onDrop: function(source, target) {
		if (target && source) {
			var sourcePos = Ext.get(source.id).dd.config.position;
			var targetPos = Ext.get(target.id).dd.config.position;

			if (sourcePos >= 0 && targetPos >= 0 && (sourcePos != targetPos)) {

				if (sourcePos > targetPos) {
					source.insertBefore(target);
				}
				else  {
					source.insertAfter(target);
				}

				this.onDropCmd(sourcePos, targetPos);
				this.init();
			}
		}
	},

	onDropCmd: function() {}
}

SqueezeJS.DDProxy = function(id, sGroup, config){
	SqueezeJS.DDProxy.superclass.constructor.call(this, id, sGroup, config);
	this.setXConstraint(0, 0);
	this.scroll = false;
	this.scrollContainer = true;
};

Ext.extend(SqueezeJS.DDProxy, Ext.dd.DDProxy, {
	// highlight a copy of the dragged item to move with the mouse pointer
	startDrag: function(x, y) {
		var dragEl = Ext.get(this.getDragEl());
		var el = Ext.get(this.getEl());
		if (this.config.list.highlighter) {
			this.config.list.highlighter.unHighlight();
			this.config.list.highlighter.isDragging = true;
		}

		dragEl.applyStyles({'z-index':2000});
		dragEl.update(el.child('div').dom.innerHTML);
		dragEl.addClass(el.dom.className + ' dd-proxy');
	},

	// disable the default behaviour which would place the dragged element
	// we don't need to place it as it will be moved in onDragDrop
	endDrag: function() {
		if (this.config.list.highlighter)
			this.config.list.highlighter.isDragging = false;
	},

	onDragEnter: function(ev, id) {
		var source = Ext.get(this.getEl());
		var target = Ext.get(id);

		if (target && source)
			this.addDropIndicator(target, source.dd.config.position, target.dd.config.position); 
	},

	onDragOut: function(e, id) {
		this.removeDropIndicator(Ext.get(id));
	},

	onDragDrop: function(e, id) {
		SqueezeJS.UI.Highlight.isDragging = false;
		this.removeDropIndicator(Ext.get(id));
		this.config.list.onDrop(Ext.get(this.getEl()), Ext.get(id));
	},

	addDropIndicator: function(el, sourcePos, targetPos) {
		if (parseInt(targetPos) < parseInt(sourcePos))
			el.addClass('dragUp');
		else
			el.addClass('dragDown');
	},

	removeDropIndicator: function(el) {
		el.removeClass('dragUp');
		el.removeClass('dragDown');
	}
});



// common button and label components, automatically updated on player events
SqueezeJS.UI.Buttons.Play = Ext.extend(SqueezeJS.UI.Button, {
	isPlaying: false,

	initComponent : function(){
		this.cls = this.cls || 'btn-play'; 
		this.tooltip = this.tooltip || SqueezeJS.string('play');
		this.text = this.text || SqueezeJS.string('play');
		SqueezeJS.UI.Buttons.Play.superclass.initComponent.call(this);
	},

	handler: function(){
		if (this.isPlaying) {
			this.updateState(false);
			SqueezeJS.Controller.playerControl(['pause']);
		}
		else {
			this.updateState(true);
			SqueezeJS.Controller.playerControl(['play']);
		}
	},

	onPlayerStateChange: function(result){
		var newState = (result.mode == 'play');

		if (this.isPlaying != newState) {
			this.updateState(newState);
		}
	},

	updateState: function(isPlaying){
		var playEl = Ext.get(Ext.DomQuery.selectNode('table:first', Ext.get(this.initialConfig.renderTo).dom));

		playEl.removeClass(['btn-play', 'btn-pause']);
		playEl.addClass(isPlaying ? 'btn-pause' : 'btn-play');

		this.setTooltip(isPlaying ? SqueezeJS.string('pause') : SqueezeJS.string('play'));
		this.setText(isPlaying ? SqueezeJS.string('pause') : SqueezeJS.string('play'));
		this.isPlaying = isPlaying;
	}
});

SqueezeJS.UI.Buttons.Rew = Ext.extend(SqueezeJS.UI.Button, {
	initComponent : function(){
		this.cls = this.cls || 'btn-previous'; 
		this.tooltip = this.tooltip || SqueezeJS.string('previous');
		this.text = this.text || SqueezeJS.string('previous');
		SqueezeJS.UI.Buttons.Rew.superclass.initComponent.call(this);
	},

	handler: function(){
		if (this.power)
			SqueezeJS.Controller.playerControl(['button', 'jump_rew']);
	},

	onPlayerStateChange: function(result){
		if (result.playlist_loop && result.playlist_loop[0] && result.playlist_loop[0].buttons) {
			try { this.setDisabled(!result.playlist_loop[0].buttons.rew) }
			catch(e){}
		}
		else if (this.disabled)
			this.enable();
	}
});

SqueezeJS.UI.Buttons.Fwd = Ext.extend(SqueezeJS.UI.Button, {
	initComponent : function(){
		this.cls = this.cls || 'btn-next';
		this.tooltip = this.tooltip || SqueezeJS.string('next');
		this.text = this.text || SqueezeJS.string('next');
		SqueezeJS.UI.Buttons.Fwd.superclass.initComponent.call(this);
	},

	handler: function(){
		if (this.power)
			SqueezeJS.Controller.playerControl(['button', 'jump_fwd']);
	}
});

SqueezeJS.UI.Buttons.Repeat = Ext.extend(SqueezeJS.UI.Button, {
	cmd_id: 'repeat',
	state: 0,

	initComponent : function(){
		this.cls = this.cls || 'btn-repeat-0';
		SqueezeJS.UI.Buttons.Repeat.superclass.initComponent.call(this);
	},

	handler: function(){
		if (this.power) {
			if (this.cmd)
				SqueezeJS.Controller.playerControl(this.cmd);
			else
				SqueezeJS.Controller.playerControl(['playlist', 'repeat', (this.state + 1) % 3]);
		} 
	},

	onPlayerStateChange: function(result){
		if (this.cmd) {}
		else if (this.state == -1 || (result['playlist repeat'] != null && this.state != result['playlist repeat']))
			this.updateState(result['playlist repeat']);

	},

	updateState: function(newState){
		this.state = newState || 0;
		this.setIcon('');
		this.setTooltip(SqueezeJS.string('repeat') + ' - ' + SqueezeJS.string('repeat' + this.state));
		this.setText(SqueezeJS.string('repeat') + ' - ' + SqueezeJS.string('repeat' + this.state));
		this.setClass('btn-repeat-' + this.state);
	}
});

SqueezeJS.UI.Buttons.Shuffle = Ext.extend(SqueezeJS.UI.Button, {
	cmd_id: 'shuffle',
	state: 0,

	initComponent : function(){
		this.cls = this.cls || 'btn-shuffle-0';
		this.tooltip = this.tooltip || SqueezeJS.string('shuffle');
		this.text = this.text || SqueezeJS.string('shuffle');
		SqueezeJS.UI.Buttons.Shuffle.superclass.initComponent.call(this);
	},

	handler: function(){
		if (this.power) {
			if (this.cmd)
				SqueezeJS.Controller.playerControl(this.cmd);
			else
				SqueezeJS.Controller.playerControl(['playlist', 'shuffle', (this.state + 1) % 3]);
		} 
	},

	onPlayerStateChange: function(result){
		if (this.cmd) {}
		else if (this.state == -1 || (result['playlist shuffle'] != null && this.state != result['playlist shuffle']))
			this.updateState(result['playlist shuffle']);

	},

	updateState: function(newState){
		this.state = newState || 0;
		this.setIcon('');
		this.setTooltip(SqueezeJS.string('shuffle' + ' - ' + SqueezeJS.string('shuffle' + this.state)));
		this.setText(SqueezeJS.string('shuffle' + ' - ' + SqueezeJS.string('shuffle' + this.state)));
		this.setClass('btn-shuffle-' + this.state);
	}
});

SqueezeJS.UI.Buttons.Power = Ext.extend(SqueezeJS.UI.Button, {
	initComponent : function(){
		this.cls = this.cls || 'btn-power';
		this.tooltip = this.tooltip || SqueezeJS.string('power');
		this.text = this.text || SqueezeJS.string('power') + ' ' + SqueezeJS.string(this.power ? 'on' : 'off');
		SqueezeJS.UI.Buttons.Power.superclass.initComponent.call(this);

		SqueezeJS.Controller.on({
			playerselected: {
				fn: function(playerobj) {
					this.setVisible(playerobj && playerobj.canpoweroff)
				},
				scope: this
			}
		});
	},

	handler: function(){
		var newState = (this.power ? '0' : '1');
		this.power = !this.power;
		this.onPlayerStateChange();
		SqueezeJS.Controller.playerControl(['power', newState]);
	},

	onPlayerStateChange: function(result){
		this.setTooltip(SqueezeJS.string('power') + SqueezeJS.string('colon') + ' ' + SqueezeJS.string(this.power ? 'on' : 'off'));
		this.setText(SqueezeJS.string('power') + SqueezeJS.string('colon') + ' ' + SqueezeJS.string(this.power ? 'on' : 'off'));

		if (this.power)
			this.el.removeClass('btn-power-off');
		else
			this.el.addClass('btn-power-off');
	}
});

SqueezeJS.UI.Buttons.PlayerDropdown = Ext.extend(Ext.SplitButton, {
	playerList : null,

	initComponent : function(){
		Ext.apply(this, {
			menu: new Ext.menu.Menu(),
			tooltip: SqueezeJS.string('choose_player'),
			arrowTooltip: SqueezeJS.string('choose_player'),
			tooltipType: 'title'
		})
		SqueezeJS.UI.Buttons.PlayerDropdown.superclass.initComponent.call(this);

		SqueezeJS.Controller.on({
			playerlistupdate: {
				fn: this.onPlayerlistUpdate,
				scope: this
			},

			playerselected: {
				fn: function(playerobj) {
					if (playerobj && playerobj.name)
						this.setText(playerobj.name)
				},
				scope: this
			}
		});
	},

	handler : function(ev){
		if(this.menu && !this.menu.isVisible()){
			this.menu.show(this.el, this.menuAlign);
		}
		this.fireEvent('arrowclick', this, ev);
	},

	onPlayerlistUpdate : function(response){
		this.menu.removeAll();
		this.menu.add(
			'<span class="menu-title">' + SqueezeJS.string('choose_player') + '</span>'
		);

		// let's set the current player to the first player in the list
		if (response['player count'] > 0 || response['sn player count'] > 0) {
			var el;

			this.playerList = new Ext.util.MixedCollection();

			this._addPlayerlistMenu(response);
			this._addSNPlayerlistMenu(response);

			// add the sync option menu item
			this.menu.add(
				'-',
				new Ext.menu.Item({
					text: SqueezeJS.string('synchronize') + '...',
					// query the currently synced players and show the dialog
					handler: function(){
						SqueezeJS.Controller.playerRequest({
							params: ['sync', '?'],
							success: this.showSyncDialog,
							failure: this.showSyncDialog,
							scope: this
						});	
					},
					scope: this,
					disabled: (this.playerList.getCount() < 2) 
				})
			);
		}

		else {
			this.menu.add(
				new Ext.menu.Item({
					text: SqueezeJS.string('no_player') + '..',
					handler: function(){
						var dlg = new Ext.BasicDialog('', {
							autoCreate: true,
							title: SqueezeJS.string('no_player'),
							modal: true,
							closable: false,
							collapsible: false,
							width: 500,
							height: 250,
							resizeHandles: 'se'
						});
						dlg.addButton(SqueezeJS.string('close'), dlg.destroy, dlg);
						dlg.addKeyListener(27, dlg.destroy, dlg);
						dlg.body.update(SqueezeJS.string('no_player_details'));
						dlg.show();
					}
				})
			);
		}

	},

	_addPlayerlistMenu : function(response){
		if (response.players_loop) {
			for (var x=0; x < response.players_loop.length; x++) {
				var playerInfo = response.players_loop[x];

				// mark the current player as selected
				if (playerInfo.playerid == SqueezeJS.Controller.getPlayer()) {
					this.setText(playerInfo.name);
				}

				// add the players to the list to be displayed in the synch dialog
				this.playerList.add(playerInfo.playerid, {
					name: playerInfo.name,
					isplayer: playerInfo.isplayer
				});

				this.menu.add(
					new Ext.menu.CheckItem({
						text: playerInfo.name,
						value: playerInfo.playerid,
						cls: 'playerList',
						group: 'playerList',
						checked: playerInfo.playerid == playerid,
						scope: this,
						handler: this._selectPlayer
					})
				);
			}
		}
	},

	_addSNPlayerlistMenu : function(response){
		// add a list of players connected to SQN, if available
		if (response.sn_players_loop) {
			var first = true;
							
			for (var x=0; x < response.sn_players_loop.length; x++) {
				var playerInfo = response.sn_players_loop[x];

				// don't display players which are already connected to SC
				// this is to prevent double entries right after a player has switched
				if (! this.playerList.get(playerInfo.playerid)) {
					if (first) {
						this.menu.add(
							'-',
							'<span class="menu-title">' + SqueezeJS.string('squeezenetwork') + '</span>'
						);
						first = false;
					}

					this.menu.add(
						new Ext.menu.Item({
							text: playerInfo.name,
							value: playerInfo.id,
							playerid: playerInfo.playerid,
							cls: 'playerList',
							scope: this,
							handler: this._confirmSwitchSQNPlayer
						})
					);
				}
			}
		}
	},

	_selectPlayer: function(ev){
		this.setText('');
		if (ev) {
			this.setText(ev.text || '');
			SqueezeJS.Controller.selectPlayer(ev.value);
		}
	},

	_confirmSwitchSQNPlayer: function(ev){
		Ext.MessageBox.confirm(
			SqueezeJS.string('squeezenetwork'),
			SqueezeJS.string('sqn_want_switch'),
			function(btn){
				if (btn == 'yes') {
					this._switchSQNPlayer(ev);
				}
			},
			this
		);
	},

	_switchSQNPlayer: function(ev){
		SqueezeJS.Controller.request({ params: ['', ['squeezenetwork', 'disconnect', ev.value ]] });

		// switch player in a few seconds, to give the player time to connect
		var update = new Ext.util.DelayedTask(function(ev){
			SqueezeJS.Controller.updateAll();
			this._selectPlayer({ value: ev.playerid });
		}, this, new Array(ev));
		update.delay(3000); 
	},

	showSyncDialog: function(response){
		var responseText = Ext.util.JSON.decode(response.responseText);

		var syncedPlayers = new Array();
		if (responseText.result && responseText.result._sync) {
			syncedPlayers = responseText.result._sync;
		}

		// make sure any previous syncgroup form is deleted; seems not to happen in on dlg.destroy() in some browsers
		var playerSelection = Ext.get('syncgroup');
		if (playerSelection)
			playerSelection.remove();

		playerSelection = '<form name="syncgroup" id="syncgroup">';
		var tpl = new Ext.Template('<input type="checkbox" id="{id}" value="{id}" {checked} {disabled}>&nbsp;<label for="{id}">{name}</label><br>');
		tpl.compile();

		// create checkboxes for other players and preselect if synced
		this.playerList.eachKey(function(id, data){
			if (id && data.name && id != playerid)
				playerSelection += tpl.apply({
					name: data.name,
					id: id,
					checked: parseInt(syncedPlayers.indexOf(id)) >= 0 ? 'checked' : '',
					disabled: data.isplayer ? '' : 'disabled'
				});
		});
		playerSelection += '</form>';

		var dlg = new Ext.Window({
			title: SqueezeJS.string('synchronize'),
			modal: true,
			collapsible: false,
			width: 400,
			height: 150 + this.playerList.getCount() * 13,
			resizeHandles: 'se',
			html: playerSelection
		});

		dlg.addButton(SqueezeJS.string('synchronize'), function(){ 
			var players = Ext.query('input', Ext.get('syncgroup').dom);

			for(var i = 0; i < players.length; i++) {
				// sync if not synced yet
				if (players[i].checked && syncedPlayers.indexOf(parseInt(players[i].id)) < 0)
					SqueezeJS.Controller.playerRequest({ params: [ 'sync', players[i].id ]});

				// unsync if no longer checked
				else if (syncedPlayers.indexOf(parseInt(players[i].id)) >= 0 & !players[i].checked)
					SqueezeJS.Controller.request({ params: [ players[i].id, [ 'sync', '-' ] ] });
			}

			dlg.destroy();
		}, dlg);

		dlg.addButton(SqueezeJS.string('cancel'), dlg.destroy, dlg);

		dlg.show();
	}
});

SqueezeJS.UI.Buttons.VolumeDown = Ext.extend(SqueezeJS.UI.Button, {
	initComponent : function(){
		this.cls = this.cls || 'btn-volume-decrease';
		this.tooltip = this.tooltip || SqueezeJS.string('volumedown');
		this.text = this.text || SqueezeJS.string('volumedown');
		SqueezeJS.UI.Buttons.VolumeUp.superclass.initComponent.call(this);
	},

	handler : function(){
		if (this.power)
			SqueezeJS.Controller.setVolume(1, '-');
	}
});

SqueezeJS.UI.Buttons.VolumeUp = Ext.extend(SqueezeJS.UI.Button, {
	initComponent : function(){
		this.cls = this.cls || 'btn-volume-increase';
		this.tooltip = this.tooltip || SqueezeJS.string('volumeup');
		this.text = this.text || SqueezeJS.string('volumeup');
		SqueezeJS.UI.Buttons.VolumeUp.superclass.initComponent.call(this);
	},

	handler : function(){
		if (this.power)
			SqueezeJS.Controller.setVolume(1, '+');
	}
});

SqueezeJS.UI.VolumeBar = Ext.extend(SqueezeJS.UI.Component, {
	power: null,
	volume : 0,

	initComponent : function(){
		SqueezeJS.UI.VolumeBar.superclass.initComponent.call(this);
	
		if (this.el && (this.el = Ext.get(this.el))) {
			var el;
			if (el = this.el.child('img:first'))
				el.on('click', this.onClick, this);
		}		
	},

	onClick: function(ev, target) {
		if (!this.power)
			return;

		var el = Ext.get(target);
		if (el) {
			var margin = 9;

			var maxWidth = el.getWidth() - 2*margin;
			var myStep = maxWidth/11;

			var myX = ev.xy[0] - el.getX() - margin - (Ext.isGecko * 5) - (Ext.isSafari * 5);
			myX = Math.max(myX, 1);
			myX = Math.min(myX, maxWidth);

			var volVal = Math.ceil(myX / myStep) - 1;

			this.updateState(volVal*10);
			SqueezeJS.Controller.setVolume(volVal);
		}
	},

	// update volume bar
	onPlayerStateChange: function(result){
		if (result['mixer volume'] != null)
			this.updateState(parseInt(result['mixer volume']));

		this.power = result.power;
	},

	updateState: function(newVolume){
		if (newVolume != this.volume) {
			var volEl;
			var volVal = Math.ceil(newVolume / 9.9); 

			if (newVolume <= 0)
				volVal = 0;
			else if (newVolume >= 100)
				volVal = 11;

			this.el.removeClass([ 'ctrlVolume0', 'ctrlVolume1', 'ctrlVolume2', 'ctrlVolume3', 'ctrlVolume4', 'ctrlVolume5', 'ctrlVolume6', 'ctrlVolume7', 'ctrlVolume8', 'ctrlVolume9', 'ctrlVolume10' ]);
			this.el.addClass('ctrlVolume' + String(Math.max(volVal-1, 0)));
	
			if (volEl = this.el.child('img:first'))
				volEl.dom.title = SqueezeJS.string('volume') + ' ' + parseInt(newVolume);

			this.volume = newVolume;
		}
	}
});


SqueezeJS.UI.Title = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		this.el.update(SqueezeJS.SonginfoParser.title(result, this.noLink));
	}
});

SqueezeJS.UI.CompoundTitle = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		var title = SqueezeJS.SonginfoParser.title(result, this.noLink, true);
		var contributors = SqueezeJS.SonginfoParser.contributors(result, this.noLink);
		var album = SqueezeJS.SonginfoParser.album(result, this.noLink);

		this.el.update(title
			+ (contributors ? '&nbsp;' + SqueezeJS.string('by') + '&nbsp;' + contributors : '')
			+ (album ? '&nbsp;' + SqueezeJS.string('from') + '&nbsp;' + album : '')
		);
	}
});

SqueezeJS.UI.Album = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		var year = SqueezeJS.SonginfoParser.year(result, this.noLink);
		this.el.update(SqueezeJS.SonginfoParser.album(result, this.noLink)
			+ (year ? '&nbsp;(' + year + ')' : ''));
	}
});

SqueezeJS.UI.Contributors = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		this.el.update(SqueezeJS.SonginfoParser.contributors(result, this.noLink));
	}
});


SqueezeJS.UI.CurrentIndex = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		this.el.update((parseInt(result.playlist_cur_index) || -1) + 1);
	}
});

SqueezeJS.UI.SongCount = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		this.el.update(parseInt(result.playlist_tracks) || 0);
	}
});

SqueezeJS.UI.Bitrate = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		this.el.update(SqueezeJS.SonginfoParser.bitrate(result, this.noLink));
	}
});

SqueezeJS.UI.Playtime = Ext.extend(SqueezeJS.UI.Component, {
	initComponent : function(config){
		if (typeof config == 'string')
			config = { el: config };

		Ext.apply(this, config);
		SqueezeJS.UI.Playtime.superclass.initComponent.call(this);
	
		SqueezeJS.Controller.on({
			playtimeupdate: {
				fn: this.onPlaytimeUpdate,
				scope: this
			}
		});
	},

	onPlaytimeUpdate : function(playtime){
		if (this.el && playtime)
			this.el.update(SqueezeJS.Utils.formatTime(playtime.current));
	}
});

SqueezeJS.UI.PlaytimeRemaining = Ext.extend(SqueezeJS.UI.Playtime, {
	onPlaytimeUpdate : function(playtime){
		if (this.el && playtime)
			this.el.update(SqueezeJS.Utils.formatTime(playtime.remaining));
	}
});

SqueezeJS.UI.CompoundPlaytime = Ext.extend(SqueezeJS.UI.Playtime, {
	onPlaytimeUpdate : function(playtime){
		if (this.el && playtime)
			this.el.update(SqueezeJS.Utils.formatTime(playtime.current) + '&nbsp;/&nbsp;' + SqueezeJS.Utils.formatTime(playtime.remaining));
	}
});

SqueezeJS.UI.PlaytimeProgress = Ext.extend(SqueezeJS.UI.Playtime, {
	initComponent : function(config){
		SqueezeJS.UI.PlaytimeProgress.superclass.initComponent.call(this);

		var el = Ext.get(this.applyTo);
		el.update( '<img src="/html/images/spacer.gif" class="progressLeft"/><img src="/html/images/spacer.gif" class="progressFillLeft"/>'
			+ '<img src="/html/images/spacer.gif" class="progressIndicator"/><img src="html/images/spacer.gif" class="progressFillRight"/>'
			+ '<img src="/html/images/spacer.gif" class="progressRight"/>' );	

		// store the DOM elements to reduce flicker
		this.remaining = Ext.get(Ext.DomQuery.selectNode('.progressFillRight', el.dom));
		this.playtime = Ext.get(Ext.DomQuery.selectNode('.progressFillLeft', el.dom));
		
		// calculate width of elements which won't be scaled
		this.fixedWidth = el.child('img.progressLeft').getWidth();
		this.fixedWidth += el.child('img.progressRight').getWidth();
		this.fixedWidth += el.child('img.progressIndicator').getWidth();

		Ext.get(this.applyTo).on('click', this.onClick);
	},

	onPlaytimeUpdate : function(playtime){
		if (this.el && playtime) {
			var left;
			var max = this.el.getWidth() - this.fixedWidth - 1; // total of left/right/indicator width

			// if we don't know the total play time, just put the indicator in the middle
			if (!playtime.duration)
				left = 0;

			// calculate left/right percentage
			else
				left = Math.max(
						Math.min(
							Math.floor(playtime.current / playtime.duration * max)
						, max)
					, 1);

			this.remaining.setWidth(max - left);
			this.playtime.setWidth(left);
		}
	},

	onClick : function(ev) {
		if (!SqueezeJS.Controller.playerStatus.duration)
			return;
 
		var pos = Math.max(ev.xy[0] - this.getX(), 0);
		pos = pos / Math.max(this.getWidth(), pos)
		SqueezeJS.Controller.playerControl(['time', pos * SqueezeJS.Controller.playerStatus.duration]);
	}
});

SqueezeJS.UI.Coverart = Ext.extend(SqueezeJS.UI.Component, {
	onPlayerStateChange : function(result){
		this.el.update(SqueezeJS.SonginfoParser.coverart(result, this.noLink, this.size));
	}
});

SqueezeJS.UI.CoverartPopup = Ext.extend(Ext.ToolTip, {
	initComponent : function(){
		if (this.songInfo)
			this.title = '&nbsp;';
 
		SqueezeJS.UI.CoverartPopup.superclass.initComponent.call(this);
		// let's try to size the width at a maximum of 80% of the current screen size
		this.maxWidth = Math.min(Ext.lib.Dom.getViewWidth(), Ext.lib.Dom.getViewHeight()) * 0.8;

		SqueezeJS.Controller.on({
			playerstatechange: {
				fn: this.onPlayerStateChange,
				scope: this
			}
		});

		this.on({
			show: {
				fn: function(el){
					if (el && el.body 
						&& (el = el.body.child('img:first', true)) 
						&& (el = Ext.get(el))
						&& (el.getWidth() > this.maxWidth))
							el.setSize(this.maxWidth - 10, this.maxWidth - 10);
				}
			}
		});

		Ext.EventManager.onWindowResize(function(){
			this.maxWidth = Math.min(Ext.lib.Dom.getViewWidth(), Ext.lib.Dom.getViewHeight()) * 0.8;
		}, this);
	},

	onPlayerStateChange : function(result){
		if (this.songInfo) {
			var title = SqueezeJS.SonginfoParser.title(result, true, true);
			var contributors = SqueezeJS.SonginfoParser.contributors(result, true);
			var album = SqueezeJS.SonginfoParser.album(result, true);
	
			this.setTitle(title
				+ (contributors ? '&nbsp;/ ' + contributors : '')
				+ (album ? '&nbsp;/ ' + album : ''));
		}

		var el = this.body;
		if (el) {
			if (el = el.child('img:first', true))
				el.src = SqueezeJS.SonginfoParser.coverartUrl(result);
		}
		else {
			this.html = SqueezeJS.SonginfoParser.coverart(result, true);
		}
	}
});


SqueezeJS.UI.Playlist = Ext.extend(SqueezeJS.UI.Component, {
	initComponent : function(){
		SqueezeJS.UI.Playlist.superclass.initComponent.call(this);

		this.container = Ext.get(this.renderTo);
		this.onResize();

		Ext.EventManager.onWindowResize(this.onResize, this);
		SqueezeJS.Controller.on({
			playerselected: {
				fn: this.onPlayerSelected,
				scope: this
			}
		});
	},

	load : function(url, showIndicator){
		if (this.getPlEl())
			// unregister event handlers
			Ext.dd.ScrollManager.unregister(this.playlistEl);

		// try to reload previous page if no URL is defined
		var um = this.container.getUpdateManager();

		if (showIndicator)
			this.container.getUpdateManager().showLoadIndicator = true;

		this.container.load(
			{
				url: url || webroot + 'playlist.html?ajaxRequest=1&player=' + SqueezeJS.getPlayer(),
				method: 'GET',
				disableCaching: true
			},
			{},
			this._onUpdated.createDelegate(this)
		);

		um.showLoadIndicator = false;
	},

	getPlEl : function(){
		return Ext.get(this.playlistEl);
	},

	onUpdated : function(){},
	
	_onUpdated : function(o){
		this.onResize();

		var el = this.getPlEl();
		if (el && (el = el.child('div.noPlayerPanel')))
			el.setDisplayed(true);			

		// shortcut if there's no player
		if (!this.getPlEl())
			return;

		this._initSortable();
		this.highlightCurrent();

		this.onUpdated(o);
	},

	_initSortable : function(){
		var offset = 0;
		if (offset = Ext.get('offset'))
			offset = parseInt(offset.dom.innerHTML);

		new SqueezeJS.UI.Sortable({
			el: this.playlistEl,
			offset: offset,
			selector: '#' + this.playlistEl + ' div.draggableSong',
			highlighter: this.Highlighter,
			onDropCmd: function(sourcePos, targetPos) {
				SqueezeJS.Controller.playerControl(
					[
						'playlist',
						'move',
						sourcePos, targetPos
					],
				true);
			}
		});
	},

	onPlaylistChange : function() {
		this.load();
	},

	onPlayerSelected : function() {
		this.load();
	},

	onResize : function(){
		var el = this.container.parent().parent();
		var plEl = this.getPlEl();
		
		var height = el.getHeight() + el.getTop() - plEl.getTop();
		if (el = Ext.get('playlistTab'))
			height -= el.getHeight();
	
		if (el = Ext.get('pagebar'))
			height -= el.getHeight();

		plEl.setHeight(height);
	},

	highlightCurrent : function(){
		var el;
		if (el = this.getPlEl()) {
			var plPos = el.getScroll();
			var plView = el.getViewSize();
			var el = Ext.DomQuery.selectNode(this.currentSelector);

			if (el) {
				el = Ext.get(el);
				if (el.getTop() > plPos.top + plView.height
					|| el.getBottom() < plPos.top)
						el.scrollIntoView(this.playlistEl);
			}
		}
	},

	request : function(cmd, el) {
		// don't accept new commands while the playlist is updating
		var um = this.getPlEl().getUpdateManager();

		if (um && um.isUpdating())
			return;

		el = Ext.get(el);
		if (el.dd && el.dd.config && parseInt(el.dd.config.position) >= 0)
			SqueezeJS.Controller.playerControl(['playlist', cmd, el.dd.config.position])
	}
});

SqueezeJS.UI.ShowBriefly = Ext.extend(Ext.Component, {
	initComponent : function(){
		SqueezeJS.UI.ShowBriefly.superclass.initComponent.call(this);

		this.template = (this.template ? new Ext.Template(this.template) : new Ext.Template('{msg}'));

		// subscribe to some default events
		SqueezeJS.Controller.on({
			showbriefly: {
				fn: this.onShowBriefly,
				scope: this
			}
		});
	},

	onShowBriefly : function(text){
		if (!this.el)
			this.el = Ext.get(this.initialConfig.renderTo);
		
		if (!this.el)
			return;

		if (text && !this.el.hasActiveFx()) {
			this.template.overwrite(this.el, { msg: text });
			this.animate();
		}
		else if (!text) {
			this.el.update('');
		}
	},

	animate : function() {
		this.el.fadeIn().pause(3).fadeOut();
	}
});

// simple one line scanner information
SqueezeJS.UI.ScannerInfo = Ext.extend(Ext.Component, {
	initComponent : function(config){
		Ext.apply(this, config);
		SqueezeJS.UI.ScannerInfo.superclass.initComponent.call(this);

		// subscribe to some default events
		SqueezeJS.Controller.on({
			scannerupdate: {
				fn: this.onScannerUpdate,
				scope: this
			}
		});
	},

	onScannerUpdate : function(result){
		if (!this.el)
			this.el = Ext.get(this.initialConfig.renderTo);
		
		if (!this.el)
			return;

		if (result.rescan) {
			if (!this.el.isVisible())
				this.show();

			var el;
			if ((el = Ext.get(this.info)) && result.progresstotal)
				el.show();
			else if (el)
				el.hide();

			if (el = Ext.get(this.total)) {
				Ext.get(this.name).update(result.progressname);
				Ext.get(this.done).update(result.progressdone) || 0;
				el.update(result.progresstotal || 0);
			}
		}
		else if (this.el.isVisible()) {
			this.hide();
		}
	},

	show : function(){
		this.el.fadeIn();
	},

	hide : function(){
		this.el.fadeOut();
	}
});

// page oriented scanner information - not configurable nor inheritable
SqueezeJS.UI.ScannerInfoExtended = function(){
	var progressTimer;

	return {
		init: function(){
			progressTimer = new Ext.util.DelayedTask(this.refresh, this);
			this.refresh();
		},

		refresh: function(){
			Ext.Ajax.request({
				method: 'GET',
				url: webroot + 'progress.html',
				params: {
					type: progresstype,
					barlen: progressbarlen,
					player: playerid,
					ajaxRequest: 1
				},
				timeout: 3000,
				disableCaching: true,
				success: this.updatePage
			});
			
		},

		updatePage: function(result){
			// clean up response to have a correct JSON object
			result = result.responseText;
			result = result.replace(/<[\/]?pre>|\n/g, '');
			result = Ext.decode(result);

			if (result['scans']) {
				var elems = ['Name', 'Done', 'Total', 'Active', 'Time', 'Bar', 'Info'];
				var el, value;

				var scans = result.scans
				for (var i=0; i<scans.length; i++) {
					if (el = Ext.get('Info'+(i-1)))
						el.setDisplayed(false);

					// only show the count if it is more than one item
					Ext.get('Count'+i).setDisplayed(scans[i].Total ? true : false);
					Ext.get('progress'+i).setDisplayed(scans[i].Name ? true : false);

					for (var j=0; j<elems.length; j++) {
						if (value = scans[i][elems[j]])
							Ext.get(elems[j]+i).update(decodeURIComponent(value));

					}
				}
			}

			if (result['message']) {
				if (result['total_time'])
					Ext.get('message').update(result.message + timestring + result.total_time);

				else
					Ext.get('message').update(result.message);
			} 

			else
				progressTimer.delay(5000)
		}
	};
}();

kWidget.addReadyCallback( function( playerId ){
	var kdp = document.getElementById( playerId );
	/**
	 * The main chaptersView object:
	 */
	var chaptersView = function(kdp){
		return this.init(kdp);
	}
	chaptersView.prototype = {
		init: function( kdp ){
			this.kdp = kdp;
			var _this = this;
			// setup api object
			this.api = new kWidget.api( this.getAttr( 'configProxy.kw.id' ) );
			
			// setup the app target:
			this.$chaptersContainer = this.getConfig( 'containerId') ? 
					$('#' + this.getConfig( 'containerId') ) : 
					this.getChapterContainer();

			this.$chaptersContainer.text( 'loading ...' );
			
			// add layout helper to container:
			this.$chaptersContainer
				.addClass('k-chapters-container')
				.addClass( _this.getLayout() );
			
			// if we added the chapterContainer set respective layout
			this.loadChapters(function( data ){
				// if an error pop out:
				if( ! _this.handleDataError( data ) ){
					return ;
				}
				// draw chapters
				_this.drawChapters( data.objects );
			});
		},
		loadChapters:function( callback ){
			// do the api request
			this.api.doRequest({
					'service': 'cuepoint_cuepoint',
					'action': 'list',
					'filter:entryIdEqual': this.getAttr( 'mediaProxy.entry.id' ),
					'filter:objectType':'KalturaCuePointFilter',
					'filter:cuePointTypeEqual':	'annotation.Annotation',
					'filter:tagsLike' : this.getConfig('tags') || 'chaptering'
				},
				callback
			);
		},
		drawChapters: function( rawCuePoints ){
			var _this = this;
			_this.$chaptersContainer.empty();
			// sort the cuePoitns by startTime:
			rawCuePoints.sort( function( a, b){
				return a.startTime - b.startTime;
			});
			// draw cuePoint
			$.each( rawCuePoints, function( inx, cuePoint ){
				// update a local customData property
				cuePoint.customData = {};
				if( cuePoint['partnerData']  && cuePoint['partnerData'] != "null" ){
					cuePoint.customData = JSON.parse( cuePoint['partnerData'] );
				}
				_this.$chaptersContainer.append(
					_this.getChaptersBox( inx, cuePoint )
				);
			});
		},
		getChaptersBox: function( inx, cuePoint ){
			var _this = this;
			// Basic chapter build out:
			var captionDesc = cuePoint.customData['desc'] || '';
			var $chapterBox = $('<div />')
			.addClass( 'chapterBox' )
			.append(
				$('<h3>').text( cuePoint['text'] ),
				captionDesc
			)
			
			// check if thumbnail should be displayed
			if( this.getConfig('includeThumbnail') ){
				$chapterBox.prepend( 
					_this.getThumbnail( cuePoint ) 
				)
			}
			
			// Only add the chapter divider ( after the first chapter )
			if( inx != 0 ){
				$chapterBox.prepend( 
						$('<div />').addClass( 'chapterDivider' )
				)
			}

			// Add click binding:
			$chapterBox.click( function(){
				// Check if the media is ready:
				if( _this.getAttr( 'playerStatusProxy.kdpStatus' ) != 'ready'){
					kWidget.log("Error: chapterView:: click before chapter ready");
					return ;
				}
				// start playback 
				_this.kdp.sendNotification( 'doPlay' );
				// see to start time and play
				_this.kdp.sendNotification( 'doSeek', cuePoint.startTime / 1000 );
			})
			
			return $chapterBox;
		},
		getThumbnail: function( cuePoint ){
			// check for custom var override of cuePoint
			$img = $('<img />').attr({
				'alt': "Thumbnail for " + cuePoint.text
			});
			// check for direct src set:
			if( cuePoint.customData['thumbUrl'] ){
				$img.attr('src', cuePoint.customData['thumbUrl'] );
				return $img;
			}
			var baseThumbSettings = {
				'partner_id': this.getAttr( 'configProxy.kw.partnerId' ),
				'uiconf_id': this.getAttr('configProxy.kw.uiConfId'),
				'entry_id': this.getAttr( 'mediaProxy.entry.id' ),
				'width': 100,
			}
			// Check if NOT using "rotator" ( just return the target time directly )
			if( !this.getConfig("thumbnailRotator" ) ){
				$img.attr('src', kWidget.getKalturaThumbUrl(
					$.extend( {}, baseThumbSettings, {
						'vid_sec': parseInt( cuePoint.startTime / 1000 )
					})
				) )
				// force aspect ( should not be needed will break things )
				$img.attr({
					'width':100,
					'height': 75
				});
			}

			// using "rotator" 
			// set image to sprite image thumb mapping: 
			/*$img.css({
				'background-image': 'url(\'' + this.getThumbSpriteUrl( cuePoint ) + '\')',
				'background-position': this.getThumbSpriteOffset( cuePoint.startTime )
			})*/
			return $img;
		},
		// get the chapter container with respective layout
		getChapterContainer: function(){
			// remove any existing k-chapters-container
			$('.k-chapters-container').remove();
			// Build new chapters container
			$chaptersContainer = $('<div>').addClass( 'k-chapters-container');
			// check for where it should be appended:
			switch( this.getConfig('containerPosition') ){
				case 'before':
					$( this.kdp )
						.css( 'float', 'none')
						.before( $chaptersContainer );
				break;
				case 'left':
					$chaptersContainer.css('float', 'left').insertBefore( this.kdp );
					$( this.kdp ).css('float', 'left');
				break;
				case 'right':
					$chaptersContainer.css('float', 'left').insertAfter( this.kdp );
					$( this.kdp ).css('float', 'left' );
				break;
				case 'after':
				default:
					$( this.kdp )
						.css( 'float', 'none')
						.after( $chaptersContainer );
				break;
			};
			// set size based on layout
			// set sizes:
			if( this.getConfig('overflow') != true ){
				if( this.getLayout() == 'horizontal' ){
					$chaptersContainer.css('width', $( this.kdp ).width() )
				} else if( this.getLayout() == 'vertical' ){
					$chaptersContainer.css( 'height', $( this.kdp ).height() )
				}
			}
			return $chaptersContainer;
		},
		getLayout: function(){
			return  this.getConfig( 'layout' ) || 'horizontal';
		},
		/**
		 * Almost generic onPage plugin code: 
		 */
		handleDataError: function( data ){
			// check for errors; 
			if( !data || data.code ){
				this.$chaptersContainer.empty().append(
					this.getError( data )
				);
				return false;
			}
			return true;
		},
		getError: function( errorData ){
			var error = {
				'title': "Error",
				'msg': "Unknown error"
			}
			switch( errorData.code ){
				case "SERVICE_FORBIDDEN":
					error.title = "Missing Kaltura Secret";
					error.msg = "The chapters editor appears to be missing a valid kaltura secret." +
							" Please retrive one from the <a target=\"_new\" href=\"http://www.kaltura.com/api_v3/testme/index.php\">api</a>," +
							"and add it to this widgets settings"
					break;
				default:
					if( errorData.message ){
						error.msg = errorData.message
					}
					break;
			}
			return $('<div class="alert alert-error">' +
			  //'<button type="button" class="close" data-dismiss="alert">x</button>' +
			  '<h4>' + error.title + '</h4> ' +
			  error.msg  + 
			'</div>' );
		},
		getAttr: function( attr ){
			return this.kdp.evaluate( '{' + attr + '}' );
		},
		getConfig : function( attr ){
			return this.kdp.evaluate('{chaptersView.' + attr + '}' );
		}
	}
	/*****************************************************************
	 * Application initialization
	 ****************************************************************/
	// We start build out before mediaReady to accelerate display of chapters
	// Once media is loaded and kdp can accept clicks, we add bindings
	if( !window.jQuery ){
		kWidget.appendScriptUrl( '//ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js', function(){
			new chaptersView( kdp );
		});
		return ;
	} else {
		new chaptersView( kdp );
	}
});
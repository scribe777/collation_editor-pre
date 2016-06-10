//
// vmr_services provides an implementation which interfaces with the VMR CRE
// used by the INTF, Wuppertal, GSI, Coptic OT Project, Avestan Digital Archive
//
var vmr_services = (function() {


//
// Add Handler to listen for messages passed to us via HTML5 postMessage
// 
window.addEventListener("message", function(event) {
	if (event && event.data && event.data.msg_type == 'set_vmr_session') {
		vmr_services._set_vmr_session(event.data.vmr_session);
		vmr_services._resume_after_session_open();
	}
}, false);

// This allows us to define a separate domain for our local services
// which can be different from the domain serving up our javascript.
// You can place it anywhere before here, but I put it with SITE_DOMAIN in sitedomain.js
if (typeof LOCAL_SERVICES_DOMAIN === 'undefined') LOCAL_SERVICES_DOMAIN = SITE_DOMAIN;


// private static properties
	var _vmr_api = 'http://ntvmr.uni-muenster.de/community/vmr/api/';
	var _data_store_service_url = _vmr_api + 'projectmanagement/project/data/';

// public vmr_services methods
return {

	_vmr_session : null,
	_resume_after_session_callback : null,
	_resume_after_session_param1 : null,
	_resume_after_session_param2 : null,
	_resume_after_session_param3 : null,
	_user : -1,
	_last_transcription_siglum_map : null,
	_last_private_transcription_siglum_map : null,

	_set_vmr_session : function (vmr_session) {
		vmr_services._vmr_session = vmr_session;
	},

	_resume_after_session_open : function () {
		return vmr_services._resume_after_session_callback(vmr_services._resume_after_session_param1, vmr_services._resume_after_session_param2, vmr_services._resume_after_session_param3);
	},
	_make_private_witness : function (witness) {
		witness.siglum += '_' + vmr_services._user._id;
		for (var j = 0; witness.witnesses && j < witness.witnesses.length; ++j) {
			witness.witnesses[j].id = witness.witnesses[j].id + '_' + vmr_services._user._id;
			for (var k = 0; k < witness.witnesses[j].tokens.length; ++k) {
				witness.witnesses[j].tokens[k].siglum = witness.witnesses[j].tokens[k].siglum + '_' + vmr_services._user._id;
			}
		}
	},

	_get_resource : function (resource_type, id, result_callback) {
		var params = {
			sessionHash : vmr_services._vmr_session,
			format      : 'json',
			projectName : vmr_services._project.project,
			userName    : vmr_services._user._id,
			key         : resource_type
		};
		if (id) {
			params.subKey = id;
		}

		$.post(_data_store_service_url+'get/', params, function (resource) {
			result_callback(resource, (resource == null?-1:200));
		}, 'text').fail(function(o) {
			result_callback(null, o.status);
		});
	},

	_put_resource : function (resource_type, id, resource, result_callback) {
		var params = {
			sessionHash : vmr_services._vmr_session,
			projectName : vmr_services._project.project,
			userName    : vmr_services._user._id,
			key         : resource_type,
			data        : JSON.stringify(resource)
		};
		if (id) {
			params.subKey = id;
		}
		$.post(_data_store_service_url+'put/', params, function(data) {
			result_callback(200);
		}).fail(function(o) {
console.log('*** Error: _put_resource failed.');
			result_callback(o.status);
		});
	},

	_delete_resource : function (resource_type, id, result_callback) {
		vmr_services._put_resource(resource_type, id, null, result_callback);
	},

	_delete_regularization_rule(rule, result_callback) {
		var params = {
			sessionHash : vmr_services._vmr_session,
			regID       : rule._id,
		};
		$.post(_vmr_api+'regularization/delete/', params, function(data) {
			if ($(data).find('error').length > 0) {
console.log('*** Error: _delete_regularization_rule failed.');
				alert($(data).find('error').attr('message'));
				result_callback(-1);
			}
			else {
				result_callback(200);
			}
		}).fail(function(o) {
			result_callback(o.status);
		});
	},

	_save_regularization_rule(rule, result_callback) {
		rule._meta = {
			_last_modified_time : new Date().getTime(),
			_last_modified_by : vmr_services._user._id,
			_last_modified_by_display : vmr_services._user.name
		};
		var params = {
			sessionHash : vmr_services._vmr_session,
			groupName   : vmr_services._project.project,
			userName    : vmr_services._user._id,
			visibility  : 'Public',
			sourceWord  : rule.t,
			targetWord  : rule.n,
			type        : rule.class
		};
		if (rule.scope == 'verse') {
			params.scope = 'Verse';
			params.verse = rule.context.unit;
		}
		else {
			params.scope = 'Global';
		}
		if (rule.comments) {
			params.comment = rule.comments;
		}
		params.options = "";
		if (rule.conditions) {
			var opts = [];
			if (rule.conditions.ignore_supplied) opts.push('IGNORE_SUPPLIED');
			if (rule.conditions.ignore_unclear) opts.push('IGNORE_UNCLEAR');
			if (rule.conditions.only_nomsac) opts.push('ONLY_NOMSAC');
			params.options = opts.join('|');
		}
		$.post(_vmr_api+'regularization/put/', params, function(data) {
			if ($(data).find('error').length > 0) {
console.log('*** Error: _save_regularization_rule failed.');
				alert($(data).find('error').attr('message'));
				result_callback(-1);
			}
			else {
				rule._id = $(data).attr('regID');
				result_callback(200);
			}
		}).fail(function(o) {
			result_callback(o.status);
		});
	},

	// returns children for a resource, e.g.,[{ name: "resource_name", type: "file", size: n }]
	_get_resource_children : function (resource_type, result_callback) {
	    var params = {
		    action : 'list_children',
		    resource_type : resource_type
	    };
	    $.post(_data_store_service_url, params, function(data) {
		result_callback(data, 200);
	    }).fail(function () { result_callback(null, 400); });
	},

	supported_rule_scopes: {
//		'once'      : 'This place, these MSS', 
		'verse'     : 'This verse, all MSS', 
//		'manuscript': 'Everywhere, these MSS', 
		'always'    : 'Everywhere, all MSS'
	},

//	get_login_url : function () { return 'http://ntvmr.uni-muenster.de/community/vmr/api/auth/session/open/form?redirURL=http://'+SITE_DOMAIN + '/collation/'; },
	get_login_url : function () { return 'http://ntvmr.uni-muenster.de'; },
	get_user_info : function (success_callback) {

		if (vmr_services._user != -1) return success_callback(vmr_services._user);

		if (vmr_services._vmr_session == null) {
			vmr_services._resume_after_session_callback = vmr_services.get_user_info;
			vmr_services._resume_after_session_param1 = success_callback;
			var ifr = document.createElement('IFRAME');
			ifr.src = "http://ntvmr.uni-muenster.de/community/vmr/api/auth/session/check?ir=parent.postMessage({'msg_type':'set_vmr_session','vmr_session':'{s}'}, '*')";
			ifr.style.display = 'none';
			document.body.appendChild(ifr);
			return;
		}
		
		var data = {'sessionHash' : vmr_services._vmr_session };
		$.get(_vmr_api + 'auth/session/check/', data, function(xml) {
			var user = {};
			if (!$(xml).find('error').length) {
				user._id = $(xml).find('user').attr('userName');
				user.email = $(xml).find('emailAddress').text();
				user.first_name = $(xml).find('firstName').text();
				user.last_name = $(xml).find('lastName').text();
				user.locale = 'en';
				user.name = user.first_name;
				var mn = $(xml).find('middleName').text();
				if (mn.length) user.name += ' ' + mn;
				user.name += ' ' + user.last_name;
			}
			else user = null;
			vmr_services._user = user;
			success_callback(user);
		}).fail(function(o) {
			success_callback(null);
		});
	},
	
	show_login_status: function (callback) {
	    var elem, login_status_message;
	    elem = document.getElementById('login_status');
	    if (elem !== null) {
		CL._services.get_user_info(function (response) {
		    if (response) {		    
				login_status_message = 'logged in as ' + response.name;
			    elem.innerHTML = login_status_message;
		    } else {
		    	elem.innerHTML = '<br/><a href="'+CL._services.get_login_url()+'">login</a>';
		    }
		    if (callback) callback();
		});
	    }
	},

	get_editing_projects : function (criteria, success_callback) {

		success_callback((!vmr_services._vmr_session || !vmr_services._vmr_session.length) ? [] : [vmr_services._project]);
			
	},
	initialise_editor : function () {
		CL._services.show_login_status(function() {
			CL._container = document.getElementById('container');
			CL._services.get_user_info(function (user) {	// success
				CL._services.get_editing_projects(undefined, function (projects) {
					CL.load_single_project_menu(projects[0]);
					CL._managing_editor = true;
				});
			});
		});
	},

	get_adjoining_verse : function (verse, is_previous, result_callback) {
		return result_callback(null);
	},

	get_verse_data : function (verse, witness_list, private_witnesses, success_callback, fail_callback) {
		var url, options;
		options = {};
		url = _vmr_api + "transcript/get/";
		
		options = {'sessionHash' : vmr_services._vmr_session, 'format': 'wce', 'indexContent': verse, 'docID': witness_list.join('|')};
		if (private_witnesses) options.userName = vmr_services._user._id;

		$.post(url, options, function (result) {

			if (private_witnesses) vmr_services._last_private_transcription_siglum_map = new Map();
			else vmr_services._last_transcription_siglum_map = new Map();

			var collate_data = result;
			
			// just clear out private_witnesses for now until we get things working for public witnesses
			if (private_witnesses) collate_data = [];

			for (var i = 0; i < collate_data.length; ++i) {
				var w = collate_data[i];
				w.transcription_siglum = w.siglum;
				(private_witnesses?vmr_services._last_private_transcription_siglum_map:vmr_services._last_transcription_siglum_map).set(w.document_id, w.siglum);
				if (private_witnesses) vmr_services._make_private_witness(w);
			}
			success_callback(collate_data);

		}).fail(function(o) {
			fail_callback(o.status);
		});
	},

	get_siglum_map : function (id_list, result_callback) {
		var siglum_map, w;
		siglum_map = {};
		//any t with no children or text nodes add sigla to siglum_map
		for (var i = 0; i < id_list.length; ++i) {
			w = vmr_services._last_transcription_siglum_map.get(id_list[i]);
			if (!w) w = vmr_services._last_private_transcription_siglum_map.get(id_list[i]);
			if (w) {
				siglum_map[w] = id_list[i];
			}
		}
		result_callback(siglum_map);
	},

	


	update_rules : function(rules, verse, success_callback) {
console.log('local_service called');
		local_services.update_rules(rules, verse, success_callback);
	},
	get_rules_by_ids : function(ids, result_callback, rules, i) {
console.log('local_service called');
		local_services.get_rules_by_ids(ids, result_callback, rules, i);
	},
	get_rules : function (verse, result_callback) {
		var params = {
			sessionHash : vmr_services._vmr_session,
			indexContent: verse,
		};
		$.post(_vmr_api+'regularization/get/', params, function(data) {
			if ($(data).find('error').length > 0) {
				alert ($(data).find('error').attr('message'));
				return result_callback([]);
			}
			var rules = [];
			$(data).find('regularization').each(function() {
				var rule = {
					_id : $(this).attr('regID'),
					_model: 'decision',
					_meta : {
						_last_modified_time : new Date().getTime(),
						_last_modified_by : $(this).attr('userID'),
						_last_modified_by_display : $(this).attr('userID')
					},
					active : true,
					type : 'regularisation',
					project : $(this).attr('group'),
					t : $(this).find('sourceWord').text(),
					n : $(this).find('targetWord').text(),
					'class' : $(this).attr('type').toLowerCase(),
				}
				if ($(this).attr('scope') == 'Global') {
					rule.scope = 'global';
				}
				else {
					rule.scope = 'verse';
					rule.context = { unit : $(this).attr('contextVerse') };
				}
				if ($(this).find('comment').length) {
					rule.comments = $(this).find('comment').text();
				}
				if ($(this).attr('optionsCodes')) {
					rule.conditions = {};
					var codes = $(this).attr('optionsCodes').split('|');
					if (codes.indexOf('IGNORE_SUPPLIED') > -1) rule.conditions.ignore_supplied = true;
					if (codes.indexOf('IGNORE_UNCLEAR') > -1) rule.conditions.ignore_unclear = true;
					if (codes.indexOf('ONLY_NOMSAC') > -1) rule.conditions.only_nomsac = true;
				}
				rules.push(rule);
			});
			result_callback(rules);
		}).fail(function(o) {
			console.log('*** failed: vmr_services.get_rules');
			result_callback([]);
		});
	},

	get_rule_exceptions : function(verse, result_callback, rules, resource_types, i) {
console.log('local_service called');
		local_services.get_rule_exceptions(verse, result_callback, rules, resource_types, i);
	},

	update_ruleset : function (for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, j, k) {
		if (typeof i === 'undefined') i = 0;
		if (typeof j === 'undefined') j = 0;
		if (typeof k === 'undefined') k = 0;
		if (i < for_deletion.length) {
			vmr_services._delete_regularization_rule(for_deletion[i], function () {
				return vmr_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, ++i, j, k);
			});
		}
		else if (j < for_addition.length) {
			vmr_services._save_regularization_rule(for_addition[j], function(status) {
				// we know how special we are and we always and only update a rule when we are adding an exception
				return vmr_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, ++j, k);
			});
		}
		else if (k < for_global_exceptions.length) {
			vmr_services.get_rules_by_ids([for_global_exceptions[k]._id], function (result) {
				//we are only asking for a single rule so we can just deal with the first thing returned
				if (result.length > 0) {
					if (result[0].hasOwnProperty('exceptions')) {
						if (result[0].exceptions.indexOf(verse) === -1 && verse) {
							result[0].exceptions.push(verse);
						}
					}
					else {
						result[0].exceptions = [verse];
					}
					//first save the exception then continue the loop in callback
					vmr_services.update_ruleset([], [], [result[0]], undefined, function () {
						return vmr_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, j, ++k);
					});
				}
				else {
					return vmr_services.update_ruleset(for_deletion, for_global_exceptions, for_addition, verse, success_callback, i, j, ++k);
				}   
			});
		}
		else if (success_callback) {
			success_callback();
		}
	},
	save_collation : function (verse, collation, confirm_message, overwrite_allowed, no_overwrite_message, result_callback) {
	    CL._services.get_user_info(function (user) {
		var key = 'collation/'+collation.status+'/'+verse;
		collation._meta = { _last_modified_time : { "$date" : new Date().getTime() }, _last_modified_by : user._id, _last_modified_by_display : user.name };
		collation._id = key;
		this._get_resource(key, null, function(result, status) {
		    // if exists
		    if (status === 200) {
			if (overwrite_allowed) {
			    var confirmed = confirm(confirm_message);
			    if (confirmed === true) {
				local_services._put_resource(key, null, collation, function(result) {
				    return result_callback(true);
				});
			    } else {
				return result_callback(false);
			    }
			} else {
			    alert(no_overwrite_message);
			    return result_callback(false);
			}
		    } else {
			// if doesn't already exist
			local_services._put_resource(key, collation, function(result) {
			    return result_callback(true);
			});
		    }
		});
	    });
	},
	get_saved_stage_ids : function (verse, result_callback) {
		var keys = [
			'collation/regularise/'+verse,
			'collation/set/'+verse,
			'collation/ordered/'+verse,
			'collation/approved/'+verse
		];
		this._get_resource(keys.join('|'), null, function(result, status) {
			if (status != 200) {
				console.log('*** Error: get_saved_stage_ids failed.');
				return result_callback(null, null, null, null);
			}
			result_callback(result[0], result[1], result[2], result[3]);
		});
	},
	get_saved_collations : function (verse, user_id, result_callback, collations, users, i) {
console.log('local_service called');
		local_services.get_saved_collations(verse, user_id, result_callback, collations, users, i);
	},
	get_user_info_by_ids : function (ids, success_callback) {
console.log('local_service called');
		local_services.get_user_info_by_ids(ids, success_callback);
	},
	load_saved_collation: function (id, result_callback) {
console.log('local_service called');
		local_services.load_saved_collation(id, result_callback);
	},
	do_collation : function(verse, options, result_callback) {
	    var url;
	    if (typeof options === "undefined") {
		options = {};
	    }
	    url = 'http://' + LOCAL_SERVICES_DOMAIN + '/collationserver/' + verse + '/';
	    if (options.hasOwnProperty('accept')) {
		url += options.accept;
	    }    
	    $.post(url, { options : JSON.stringify(options) }, function(data) {
		result_callback(data);
	    }).fail(function(o) {
		result_callback(null);
	    });
	},


	_project : {
			_id: 'ECM Matthew',
			project: 'ECM Matthew',
			V_for_supplied: true,
			collation_source: 'WCE',
			book_name: 'Matthew',
			language: 'grc',
			book:'mt',
			base_text:'1002800',
			local_js_file : ['/collation/js/vmrcre_functions.js'],
			context_input : {
				'form': 'vmrcre_verse_selector.html', 
				'onload_function': 'VMRCRE.context_input_form_onload', 
				'result_provider': 'VMRCRE.get_context_from_input_form'
			},
			managing_editor:'tagriffitts',
			editors:['tagriffitts', 'cat', "4fec7b934a64b14976000001","4ff15e524a64b14976000006"],


    "local_python_implementations": {
        "prepare_t": {
            "python_file": "collation.greek_implementations",
            "class_name": "PrepareData",
            "function": "prepare_t"
        },
        "set_rule_string": {
            "python_file": "collation.greek_implementations",
            "class_name": "PrepareData",
            "function": "set_rule_string"
        }
    },
    "rule_conditions": {
        "python_file": "collation.greek_implementations",
        "class_name": "RuleConditions",
        "configs": [
            {
                "id": "ignore_supplied",
                "label": "Ignore supplied markers",
                "linked_to_settings": true,
                "setting_id": "view_supplied",
                "function": "ignore_supplied",
                "apply_when": true,
                "check_by_default": false,
                "type": "string_application"
            },
            {
                "id": "ignore_unclear",
                "label": "Ignore unclear markers",
                "linked_to_settings": true,
                "setting_id": "view_unclear",
                "function": "ignore_unclear",
                "apply_when": true,
                "check_by_default": false,
                "type": "string_application"
            },
            {
                "id": "only_nomsac",
                "label": "Only apply to Nomina Sacra",
                "linked_to_settings": false,
                "function": "match_nomsac",
                "apply_when": true,
                "check_by_default": false,
                "type": "boolean"
            }
        ]
    },
    "display_settings": {
        "python_file": "collation.greek_implementations",
        "class_name": "ApplySettings",
        "configs": [
            {
                "id": "view_supplied",
                "label": "view supplied text",
                "function": "hide_supplied_text",
                "menu_pos": 1,
                "execution_pos": 2,
                "check_by_default": true,
                "apply_when": false
            },
            {
                "id": "view_unclear",
                "label": "view unclear text",
                "function": "hide_unclear_text",
                "menu_pos": 2,
                "execution_pos": 4,
                "check_by_default": true,
                "apply_when": false
            },
            {
                "id": "view_capitalisation",
                "label": "view capitalisation",
                "function": "lower_case_greek",
                "menu_pos": 4,
                "execution_pos": 2,
                "check_by_default": false,
                "apply_when": false
            },
            {
                "id": "use_lemma",
                "function": "select_lemma",
                "menu_pos": null,
                "execution_pos": 1,
                "check_by_default": true,
                "apply_when": true
            },
            {
                "id": "expand_abbreviations",
                "label": "expand abbreviations",
                "function": "expand_abbreviations",
                "menu_pos": 5,
                "execution_pos": 1,
                "check_by_default": true,
                "apply_when": true
            }
        ]
    },
    "regularisation_classes": [
        {
            "name": "None",
            "linked_appendix": false,
            "keep_as_main_reading": false,
            "create_in_SV": false,
            "suffixed_label": false,
            "value": "none",
            "suffixed_reading": false,
            "create_in_RG": true,
            "create_in_OR": true,
            "subreading": false,
            "suffixed_sigla": false
        },
        {
            "name": "Reconstructed",
            "linked_appendix": false,
            "keep_as_main_reading": false,
            "create_in_SV": true,
            "suffixed_label": false,
            "value": "reconstructed",
            "suffixed_reading": false,
            "create_in_RG": false,
            "create_in_OR": true,
            "subreading": false,
            "identifier": "V",
            "suffixed_sigla": true
        },
        {
            "name": "Orthographic",
            "linked_appendix": false,
            "keep_as_main_reading": false,
            "create_in_SV": true,
            "suffixed_label": true,
            "value": "orthographic",
            "suffixed_reading": false,
            "create_in_RG": true,
            "create_in_OR": true,
            "subreading": true,
            "identifier": "o",
            "suffixed_sigla": false
        },
        {
            "name": "Regularised",
            "linked_appendix": false,
            "keep_as_main_reading": false,
            "create_in_SV": true,
            "RG_default": true,
            "value": "regularised",
            "suffixed_reading": false,
            "create_in_RG": true,
            "suffixed_label": false,
            "subreading": false,
            "create_in_OR": true,
            "identifier": "r",
            "suffixed_sigla": true
        },
        {
            "name": "Abbreviation",
            "linked_appendix": false,
            "keep_as_main_reading": false,
            "create_in_SV": true,
            "suffixed_label": false,
            "value": "abbreviation",
            "suffixed_reading": false,
            "create_in_RG": true,
            "create_in_OR": true,
            "subreading": false,
            "suffixed_sigla": false
        }
    ],
	witnesses:["1002800", "20001","20002", "20003", "20004", "20005", "20006", "20007"]
}
};})();

CL.set_service_provider(vmr_services);

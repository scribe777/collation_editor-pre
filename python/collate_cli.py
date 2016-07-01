import sys
import os
import imp
import json
import StringIO
from collation.preprocessor import PreProcessor
from collation.exporter_factory import ExporterFactory

def collation(params):
    requested_witnesses = params['data_settings']['witness_list']    
    data_input = params['data_input']  
    rules = params['rules']
    
    if request.params.accept:
        accept = request.params.accept
    else:
        accept = 'lcs'
    
    if 'project' in params:
        project = params['project']
    else:
        project = None
        
    if 'base_text' in params['data_settings']:
        basetext_transcription = params['data_settings']['base_text']
    
    collate_settings = {}
    collate_settings['host'] = 'localhost:7369'
    if 'algorithm' in params['algorithm_settings']:
        collate_settings['algorithm'] = params['algorithm_settings']['algorithm']
    collate_settings['tokenComparator'] = {}
    if 'fuzzy_match' in params['algorithm_settings']:
        collate_settings['tokenComparator']['type'] = 'levenshtein'
        if 'distance' in params['algorithm_settings']:
            collate_settings['tokenComparator']['distance'] = params['algorithm_settings']['distance']
        else:
            #default to 2
            collate_settings['tokenComparator']['distance'] = 2
    else:
        collate_settings['tokenComparator']['type'] = 'equality'

    if 'display_settings_config' in params:
        display_settings_config = params['display_settings_config']

    if 'display_settings' in params:
        display_settings = params['display_settings']
    
    if 'local_python_functions' in params:
        local_python_functions = params['local_python_functions']
    else:
        local_python_functions = None
        
    if 'rule_conditions_config' in params:
        rule_conditions_config = params['rule_conditions_config']
    else:
        rule_conditions_config = None
        
    p = PreProcessor(display_settings_config, local_python_functions, rule_conditions_config)
    output = p.process_witness_list(data_input, requested_witnesses, rules, basetext_transcription, project, display_settings, collate_settings, accept)
    print(output)
    response.content_type = 'application/json'
    return json.dumps(output)#, default=json_util.default)
    

def apparatus():
    data = json.loads(request.params.data)
    format = request.params.format
    if not format:
        format = 'xml'
    if format == 'xml':
        file_ext = 'xml'
    else:
        file_ext = 'txt'
    exporter_settings = request.params.settings
    print(exporter_settings)
    exf = ExporterFactory(exporter_settings)
    app = StringIO.StringIO(exf.export_data(data, format))
    response.content_type = 'text/plain'
    response.headers['Content-Disposition'] = 'attachment; filename="%s-apparatus.%s"' % (format, file_ext)
    response.set_cookie('fileDownload', 'true')
    return app
    
    

args = sys.argv
params = json.loads(args[1])
collation(params)

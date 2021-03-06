#
# Copyright 2006-2008 Appcelerator, Inc.
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#    http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License. 


include Appcelerator
CommandRegistry.registerCommand(%w(add:control add:controls),'add control to a project',[
  {
    :name=>'name',
    :help=>'name of the control to add (such as input)',
    :required=>true,
    :default=>nil,
    :type=>Types::AnyType
  },
  {
    :name=>'path',
    :help=>'path of the project to add the control to',
    :required=>false,
    :default=>nil,
    :type=>[
      Types::FileType,
      Types::DirectoryType,
      Types::AlphanumericType
    ],
    :conversion=>Types::DirectoryType
  }
],[
  {
    :name=>'version',
    :display=>'--version=X.X.X',
    :help=>'specify a version of the control to use',
    :value=>true
  }
],[
  'add:control panel',
  'add:controls panel,select',
  'add:control panel ~/myproject'
]) do |args,options|
  
  pwd = File.expand_path(args[:path] || Dir.pwd)
  project = options[:project] || Project.load(pwd)
  # this is used to make sure we're in a project directory
  # but only if we didn't pass in path
  Project.get_service(pwd) unless options[:ignore_path_check]
    
  FileUtils.cd(pwd) do 

    with_io_transaction(project, options[:tx]) do |tx|
      
      control_names = args[:name].split(',').uniq
      control_names.each do |name|
                
        control = Installer.require_component(:control, name, options[:version], options)
        control_name = control[:name].gsub ':', '_'
        
        to_dir = project.get_control_path(control_name)
        tx.mkdir to_dir

        event = {:project=>project, :control=>control}
        PluginManager.dispatchEvents('add_control', event) do
          Installer.copy tx, control[:dir], to_dir

          project.config[:controls] = [] unless project.config.has_key?(:controls)
          controls = project.config[:controls]

          controls.delete_if { |w| w[:name] == name } 
          controls << control.clone_keys(:name, :version, :checksum)
        end
        puts "Added #{control[:name]} #{control[:version]}" unless OPTIONS[:quiet] or options[:quiet]
      end
      project.save_config() unless options[:no_save]
    end
    
  end
end

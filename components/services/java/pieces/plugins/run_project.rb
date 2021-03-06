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
class RunJavaPlugin < Appcelerator::Plugin

  def plugin_registered
    
    CommandRegistry.registerCommand('run:project',
    'run this Appcelerator project with the Jetty server', [
      {
        :name=>'path',
        :help=>'directory to run in, defaults to working directory',
        :required=>false,
        :default=>nil,
        :type=>[
          Appcelerator::Types::FileType,
          Appcelerator::Types::DirectoryType,
          Appcelerator::Types::AlphanumericType
        ],
        :conversion=>Appcelerator::Types::DirectoryType
      }
    ],[
      {
         :name=>'port',
         :display=>'--port=port',
         :help=>'port to listen for requests.',
         :default=>4000,
         :value=>true
      },
      {
        :name=>'scan_period',
        :display=>'--scan-period=ms',
        :help=>'scan period in milliseconds.',
        :default=>5000,
        :value=>true
      }
    ],
    nil,
    :project) do |args,options|

      pwd = File.expand_path(args[:path] || Dir.pwd)
      port = options[:port]
      scanperiod = options[:scan_period]

      sep = RUBY_PLATFORM=~/win32/ ? ';' : ':'
      pathsep = RUBY_PLATFORM=~/win32/ ? '\\' : '/'

      project = Project.load(pwd)

      FileUtils.cd Dir.pwd do |dir|

        # test to make sure we have java on our path
        nullout = RUBY_PLATFORM=~/win32/ ? 'NUL' : '/dev/null'

        system "java -version 2>#{nullout}"
        if $?.exitstatus == 127
          puts "Failed to find java, you need to have java installed and on your path."
          exit 1
        end

        webdir = project.config[:paths][:web]
        servicesdir = project.config[:paths][:services]
        libdir = project.config[:paths][:lib]
        confdir = project.config[:paths][:config] || 'config'
        tmpdir = project.config[:paths][:tmp] || 'tmp'

        agentjar = ""
        agentjars = Dir["#{libdir}/appcelerator*.jar"].inject([]) do |agentjars,file|
            agentjar = "#{file}"
        end

        jars = Dir["#{libdir}/**/**"].inject([]) do |jars,file|
          jars << "#{file}".gsub(/\//,pathsep) if File.extname '.jar'
        end
        props = []
        OPTIONS.each do |k,v|
          props << "-#{k}=#{v}" if k.to_s[0,1]=='D'
          props << "-#{k}" if k.to_s[0,1]=='X'
        end
        props = props.join(' ')
        cp = "#{servicesdir}"
        cp << sep
        
        # put the config directory files in WEB-INF on the classpath
        webinf = FileUtils.mkdir_p File.join(tmpdir,'WEB-INF')
        webinfclasses = FileUtils.mkdir_p File.join(webinf,'classes')
        FileUtils.cp_r File.expand_path(confdir)+'/.', tmpdir
 
        cp << tmpdir
        cp << sep
        cp << File.join(tmpdir,'WEB-INF')
        cp << sep
        cp << File.join(tmpdir,'WEB-INF','classes')
        cp << sep

        if File.exists?('output/classes')
          cp << "output#{pathsep}classes" 
          cp << sep
        end

        cp << jars.join(sep)
        puts "jvm opts is:"
# if you want to run in debug mode do the below:
#        cmd = "java -Xrunjdwp:transport=dt_socket,address=8787,server=y,suspend=n -javaagent:#{agentjar} -cp #{cp} #{props} org.appcelerator.endpoint.HTTPEndpoint #{port} \"#{webdir}\" \"#{servicesdir}\" \"#{tmpdir}\" #{scanperiod}"
        cmd = "java -javaagent:#{agentjar} -cp #{cp} #{props} org.appcelerator.endpoint.HTTPEndpoint #{port} \"#{webdir}\" \"#{servicesdir}\" \"#{tmpdir}\" #{scanperiod}"
        puts cmd if OPTIONS[:verbose]

        event = {:project=>project}
        PluginManager.dispatchEvents('run_server',event) do
          system(cmd)
        end
      end
    end
  end
end

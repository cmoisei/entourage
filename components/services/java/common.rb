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

def compile_dir(source_dir, output_dir, cp_dirs)
  puts "Compiling Java files..." #if VERBOSE
  output_dir = File.expand_path(output_dir)

  if (cp_dirs.class != Array)
    cp_dirs = [cp_dirs]
  end
  puts "Platform #{RUBY_PLATFORM}" if VERBOSE
  puts "Compiling #{source_dir} to #{output_dir} with classpath: #{cp_dirs}" if VERBOSE
  java_path_separator = is_win32 ? ';' : ':'
  
  cp = cp_dirs.collect{|d| Dir["#{d}/**/*.jar"]}.flatten()
  cp = cp.join(java_path_separator)
  puts "Classpath cotents: #{cp}" if VERBOSE 
  
  currentFolder = File.dirname(__FILE__);
  if is_win32 
	cp = cp.gsub( currentFolder, ".");
  end
  
  FileUtils.cd(source_dir) do
    src_files = Dir["**/*.java"].collect{|file| File.expand_path(file)}
    src_files = src_files.join(' ')

	if is_win32 
	src_files = src_files.gsub( currentFolder, ".");
	end
	
	puts "Current folder #{currentFolder}" if VERBOSE
    FileUtils.mkdir_p "#{output_dir}" unless File.exists? "#{output_dir}"
	Dir.chdir(currentFolder) do
		cmdDir = File.dirname(__FILE__);
		puts "running in folder #{cmdDir}" if VERBOSE
		puts "javac -g -cp #{cp} #{src_files} -source 1.5 -target 1.5 -d #{output_dir}" if VERBOSE
		call_command "javac -g -cp #{cp} #{src_files} -source 1.5 -target 1.5 -d #{output_dir} -Xlint:deprecation -Xlint:unchecked"
	end
  end
end

def create_jar(jar_file, class_dir)
  FileUtils.cd(class_dir) do
     if is_win32
       call_command "jar cvf #{jar_file} ."
      else
       system "jar cvf #{jar_file} ." if VERBOSE
       system "jar cvf #{jar_file} . >/dev/null" unless VERBOSE
     end
  end
end

def create_jar_wmf(jar_file, class_dir, manifest)
  tmpmanif = File.join(class_dir, 'tmpmanif')
  f = File.open tmpmanif,'w'
  f.puts manifest
  f.close
  puts "Building jar file from #{class_dir}"
  FileUtils.cd(class_dir) do
     if is_win32
	   puts ">>> jar cmvf #{tmpmanif} #{jar_file} ." if VERBOSE
       call_command "jar cmvf #{tmpmanif} #{jar_file} . >> jar.txt"
      else
       system "jar cmvf #{tmpmanif} #{jar_file} ." if VERBOSE
       system "jar cmvf #{tmpmanif} #{jar_file} . >/dev/null" unless VERBOSE
     end
  end
  puts "Done."
end

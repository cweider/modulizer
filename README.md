# Modulizer #

## What Is It? ##
This is a tool that will produce a self-contained, environment neutral (read: browser friendly) script from specified files built to the emerging [CommonJS module standard](http://wiki.commonjs.org/wiki/Modules/1.1).

## Use ##
The command line tools accepts the following arguments:

 * `--library-path`: Any imported files contained within one of the specified library-paths, will be imported with the appropriate library style path (no leading slash).
 * `--root-path`: Path that all non-library imports will be relative to. Defaults to `process.cwd()`.
 * `--import-libraries`: Import all files found in any the libraries specified.
 * `--import-root`: Import all files contained within the specified root path.
 * `--import-dependencies`: Evaluates the required file and includes all files that are required for that evaluation.
 * `--import`: Import the modules at the paths following.
 * `--exclude`: Do not import the modules in the newline separated list specified.
 * `--global-key-path`: The global accessor for the module system, useful when namespacing. This is also the path at which the kernel is installed if specified. Defaults to `require`. 
 * `--include-kernel`: This prepends the output with a basic implementation of a CommonJS module loader.
 * `--use-system-paths`: Treat the input and output paths as paths on the file system instead of module paths.

## License ##
Released under zlib

    Copyright (C) 2011 Chad Weider

    This software is provided 'as-is', without any express or implied
    warranty.  In no event will the authors be held liable for any damages
    arising from the use of this software.

    Permission is granted to anyone to use this software for any purpose,
    including commercial applications, and to alter it and redistribute it
    freely, subject to the following restrictions:

    1. The origin of this software must not be misrepresented; you must not
       claim that you wrote the original software. If you use this software
       in a product, an acknowledgment in the product documentation would be
       appreciated but is not required.
    2. Altered source versions must be plainly marked as such, and must not be
       misrepresented as being the original software.
    3. This notice may not be removed or altered from any source distribution.

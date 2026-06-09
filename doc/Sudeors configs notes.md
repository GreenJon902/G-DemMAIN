It's easiest to let g_web have access to some specific sudo commands for systemd unit management.
To allow this we will modify the sudoers file.
This is dangerous as a syntax error could cause quite the headache.

Hence when copying the file, we follow the following process. Files will be stored in `/etc/sudoers.d/`.
1. Check config is initially formed correctly - `sudo visudo -c`.
2. Save the old copies of the sudeors files.
3. Move the new files into the folder.
4. Check the new config - `sudo visudo -c`.
5. If this fails then move the old configs back in, and again check the config - `sudo visudo -c`.

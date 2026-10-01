package com.opengas.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity { @Override public void onCreate(android.os.Bundle savedInstanceState) { registerPlugin(BackupFilePlugin.class); super.onCreate(savedInstanceState); } }

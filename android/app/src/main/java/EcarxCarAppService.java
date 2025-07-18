package com.ecarx.bot.car;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

public class EcarxCarAppService extends CarAppService {
    
    @NonNull
    @Override
    public HostValidator createHostValidator() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        } else {
            return new HostValidator.Builder(getApplicationContext())
                    .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                    .build();
        }
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new EcarxSession();
    }

    public class EcarxSession extends Session {
        
        @NonNull
        @Override
        public Screen onCreateScreen(@NonNull Intent intent) {
            return new MainScreen(getCarContext());
        }
    }
}
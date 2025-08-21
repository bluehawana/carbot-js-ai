# CarBot Android Auto ProGuard Rules for Production APK
# Generated for optimal performance and security

# Keep all public APIs that might be used by Android Auto
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Keep Android Auto Car App Library classes
-keep class androidx.car.app.** { *; }
-keep interface androidx.car.app.** { *; }
-dontwarn androidx.car.app.**

# Keep CarBot service classes - required for Android Auto integration
-keep class com.aicarbot.app.car.** { *; }
-keep class com.aicarbot.app.voice.** { *; }

# Keep main components
-keep public class com.aicarbot.app.MainActivity
-keep public class com.aicarbot.app.car.AiCarBotService
-keep public class com.aicarbot.app.voice.VoiceMediaService

# Keep serialization classes for API communication
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep Retrofit and OkHttp classes
-keep class retrofit2.** { *; }
-keep class okhttp3.** { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**

# Keep Gson classes
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# Keep Android Support/AndroidX classes
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep permissions library
-keep class pub.devrel.easypermissions.** { *; }

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Optimize resource references
-keep class **.R
-keep class **.R$* {
    <fields>;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep classes with specific constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Keep Parcelable implementations
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep media session classes for voice integration
-keep class androidx.media.** { *; }
-dontwarn androidx.media.**

# Security: Remove stack traces in production
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
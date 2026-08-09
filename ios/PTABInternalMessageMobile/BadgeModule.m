#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface BadgeModule : NSObject <RCTBridgeModule>
@end

@implementation BadgeModule

RCT_EXPORT_MODULE(BadgeModule);

RCT_EXPORT_METHOD(setBadgeCount:(NSInteger)count) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].applicationIconBadgeNumber = count;
  });
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end

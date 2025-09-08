import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const ScrollingText = ({
                           text = "GROOVI",
                           speed = 24,
                           opacity = 0.08,
                           fontSize = 50,
                           color = "white",
                           angle = -12,
                           position = "middle"
                       }) => {
    const scrollAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const pattern = `${text} • `;
        const charWidth = fontSize * 0.6;
        const patternWidth = pattern.length * charWidth;

        scrollAnim.setValue(0);
        Animated.loop(
            Animated.timing(scrollAnim, {
                toValue: -patternWidth,
                duration: (patternWidth / speed) * 1000,
                useNativeDriver: true,
            }),
            { iterations: -1 }
        ).start();
    }, [scrollAnim, text, speed, fontSize]);

    const getPositionStyle = () => {
        const { height: screenHeight } = Dimensions.get('window');

        let baseTop;
        switch(position) {
            case "top":
                baseTop = 100;
                break;
            case "bottom":
                baseTop = screenHeight - 200;
                break;
            default:
                baseTop = screenHeight * 0.15;
                break;
        }

        return {
            top: baseTop,
            marginTop: -fontSize/2,
        };
    };

    const pattern = `${text} • `;
    const charWidth = fontSize * 0.6;
    const patternWidth = pattern.length * charWidth;
    const screenCoverage = Math.ceil(screenWidth / patternWidth) + 5;
    const totalPatterns = screenCoverage * 12000;
    const displayText = pattern.repeat(totalPatterns);

    return (
        <View style={styles.container} pointerEvents="none">
            <Animated.View
                style={[
                    styles.scrollingLine,
                    getPositionStyle(),
                    {
                        transform: [
                            { translateX: scrollAnim },
                            { rotate: `${angle}deg` }
                        ],
                    },
                ]}
            >
                <Text style={[styles.scrollingText, {
                    fontSize,
                    color,
                    opacity
                }]}>
                    {displayText}
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        zIndex: 0,
    },
    scrollingLine: {
        position: 'absolute',
        flexDirection: 'row',
        width: '3000%',
    },
    scrollingText: {
        fontWeight: 'bold',
        letterSpacing: 2,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
});

export default ScrollingText;
import React, { PropTypes, Component } from 'react';
import {
  View,
  Image,
  NativeModules,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  ListView,
  InteractionManager
} from 'react-native';
import { calculateCornerResult, msToSec } from '../utils';

const { RNTrimmerManager: TrimmerManager } = NativeModules;
const { width } = Dimensions.get('window');
const cornerItemWidth = 10;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row',
  },
  corners: {
    position: 'absolute',
    height: 50,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rightCorner: {
    position: 'absolute',
    flex: 1,
  },
  centerCorner:{
    position: 'absolute',
    flex: 1,
    borderWidth:1,
    borderColor:'white'
  },
  leftCorner: {
    position: 'absolute',
    flex: 1,
  },
  bgBlack: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width
  },
  cornerItem: {
    backgroundColor: 'gray',
    width: cornerItemWidth,
    height: 50
  },
});
export class Trimmer extends Component {
  static propTypes = {
    source: PropTypes.string.isRequired,
    onChange: PropTypes.func,
    limitMaxTime:PropTypes.number.isRequired,  //seconds
    limitMinTime:PropTypes.number.isRequired  //seconds
  };
  static defaultProps = {
    onChange: () => null
  };

  constructor(props) {
    super(props);
    let imageList = new ListView.DataSource({
        rowHasChanged: (r1, r2) => r1 !== r2
    });
    let leftMargin  = this.props.leftMargin | 40 ;
    let rightMargin = this.props.rightMargin | 40 ;
    let validWidth = width - leftMargin - rightMargin;
    this.state = {
      images: [],
      imageList:imageList,
      duration: -1,
      leftCorner: new Animated.Value(0),
      rightCorner: new Animated.Value(0),
      layoutWidth: width,
      limitMaxTime: this.props.limitMaxTime | 10,
      limitMinTime:this.props.limitMinTime | 1,
      imageWidth: validWidth / (this.props.limitMaxTime !==0 ? this.props.limitMaxTime : 10),
      leftMargin:leftMargin,
      rightMargin:rightMargin,
    };

    this.leftResponder = null;
    this.rigthResponder = null;

    this._startTime = 0;
    this._endTime = 0;
    this._handleRightCornerMove = this._handleRightCornerMove.bind(this);
    this._handleLeftCornerMove = this._handleLeftCornerMove.bind(this);
    this._retriveInfo = this._retriveInfo.bind(this);
    this._retrivePreviewImages = this._retrivePreviewImages.bind(this);
    this._handleRightCornerRelease = this._handleRightCornerRelease.bind(this);
    this._handleLeftCornerRelease = this._handleLeftCornerRelease.bind(this);
    this._leftCornerPos = 0;
    this._rightCornerPos = 0;
    this._limitMinWidth = this.state.limitMinTime * this.state.imageWidth;
    this._listViewPos = 0;
    this._totalTimeWidth = 0;
  }

  componentWillMount() {
    // @TODO: Cleanup on unmount
    this.state.leftCorner.addListener(({ value }) => this._leftCornerPos = value);
    this.state.rightCorner.addListener(({ value }) => this._rightCornerPos = value);

    this.leftResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onMoveShouldSetPanResponderCapture: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onPanResponderMove: this._handleLeftCornerMove,
      onPanResponderRelease: this._handleLeftCornerRelease,
      onShouldBlockNativeResponder: (evt, gestureState) => {
        return false;
      },
    });

    this.rightResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onMoveShouldSetPanResponderCapture: (e, gestureState) => Math.abs(gestureState.dx) > 0,
      onPanResponderMove: this._handleRightCornerMove,
      onPanResponderRelease: this._handleRightCornerRelease,
      onShouldBlockNativeResponder: (evt, gestureState) => {
        return false;
      },
    });

    const { source = '' } = this.props;

    if (!source.trim()) {
      throw new Error('source should be valid string');
    }
    //this._retrivePreviewImages();
    //this._retriveInfo();
  }

  componentDidMount(){
    InteractionManager.runAfterInteractions(() => {
        this._retriveInfo();
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.source !== this.props.source) {
      this._retrivePreviewImages();
      this._retriveInfo();
    }
  }

  componentWillUnmount() {
    this.state.leftCorner.removeAllListeners();
    this.state.rightCorner.removeAllListeners();
  }

  _handleRightCornerRelease() {
    this.state.rightCorner.setOffset(this._rightCornerPos);
    this.state.rightCorner.setValue(0);
  }

  _handleRightCornerMove(e, gestureState) {
    const { duration, layoutWidth } = this.state;
    const leftPos = this._leftCornerPos;
    const rightPos = this._rightCornerPos;
    const spacePos = layoutWidth - ( Math.abs(leftPos) + Math.abs(rightPos) )
    - (this.state.leftMargin + this.state.rightMargin);
    //const rightPos = layoutWidth - Math.abs(this._rightCornerPos);
    const moveLeft = gestureState.dx < 0;
    if (spacePos <= this._limitMinWidth  && moveLeft) {
      return;
    }else if(rightPos >= 0  &&  !moveLeft){
      return;
    }
    this._endTime = this._getEndTime();
    this._callOnChange();
    Animated.event([
      null, { dx: this.state.rightCorner }
     ])(e, gestureState);
  }

  _handleLeftCornerRelease() {
    this.state.leftCorner.setOffset(this._leftCornerPos);
    this.state.leftCorner.setValue(0);
  }

  _handleLeftCornerMove(e, gestureState) {
    const { duration, layoutWidth } = this.state;
    const leftPos = this._leftCornerPos;
    const rightPos = this._rightCornerPos;
    const moveRight = gestureState.dx > 0;
    const spacePos = layoutWidth - ( Math.abs(leftPos) + Math.abs(rightPos) )
                      - (this.state.leftMargin + this.state.rightMargin);
    if (spacePos <= this._limitMinWidth && moveRight) {
      return;
    }else if(leftPos <=  0 && !moveRight){
      return;
    }
    this._startTime = this._getStartTime();
    this._callOnChange();

    Animated.event([
      null,
       { dx: this.state.leftCorner }
     ])(e, gestureState);
  }

  _callOnChange() {
    this.props.onChange({
      startTime: this._startTime,
      endTime: this._endTime
    });
  }

  _retriveInfo() {
    TrimmerManager
      .getVideoInfo(this.props.source)
      .then((info) => {
        TrimmerManager
          .getPreviewImages(this.props.source)
          .then(({ images }) => {
            this.setState({
              duration: info.duration,
              images:  images
            });
            this._totalTimeWidth  =  this.state.imageWidth * this.state.images.length;
            this._endTime = this._getEndTime();
            this._callOnChange();
          })
          .catch((e) => console.error(e));
      });

  }

  _retrivePreviewImages() {
    TrimmerManager
      .getPreviewImages(this.props.source)
      .then(({ images }) => {
        this.setState({ images });
      })
      .catch((e) => console.error(e));
  }

  renderLeftSection() {
    const { leftCorner, layoutWidth } = this.state;
    return (
      <Animated.View
        style={[styles.container,styles.leftCorner, {
          right: layoutWidth / 2 - this.state.leftMargin,
          transform: [{
            translateX: leftCorner,
          }]
        }]}
        {...this.leftResponder.panHandlers}
      >
        <View style={styles.row}>
          <View style={styles.bgBlack} />
          <View style={styles.cornerItem} />
        </View>
      </Animated.View>
    );
  }

  renderRightSection() {
    const { rightCorner, layoutWidth } = this.state;
    return (
      <Animated.View
        style={[styles.container, styles.rightCorner, {
          left: layoutWidth / 2 - this.state.rightMargin
          },
          {
          transform: [{
            translateX: rightCorner
          }]
        }]}
        {...this.rightResponder.panHandlers}
      >
        <View style={styles.row}>
          <View style={styles.cornerItem} />
          <View style={styles.bgBlack} />
        </View>
      </Animated.View>
    )
  }




  _renderRow(uri,sectionID,rowID){
    return (
          <Image
            key={`preview-source-${rowID}`}
            source={{uri}}
            style={{
              width: this.state.imageWidth,
              height: 50,
              resizeMode: 'cover',
            }}
          />
    );
  }

  _onScroll(evt){
    //listview 滑动时根据滑动的位置，触发时间的计算
    let position = evt.nativeEvent.contentOffset.x; //listview移动位置
    const totalListViewLength = this._totalTimeWidth + this.state.leftMargin + this.state.rightMargin; //总的ListView长度
    if(position <= 0 ){
          position = 0;
    }else if(position + width  >= totalListViewLength){
          position = totalListViewLength - width;
    }
    this._listViewPos  = position;
    this._startTime = this._getStartTime();
    this._endTime = this._getEndTime();
    this._callOnChange();
  }

  _getStartTime(){
     const unit = this.state.duration / this._totalTimeWidth;
     const val = Math.abs(this._listViewPos) + Math.abs(this._leftCornerPos);
     return val * unit;
  }

  _getEndTime(){
     const cornerWidth = cornerItemWidth * 2
     const unit = this.state.duration / this._totalTimeWidth;
     const val = Math.abs(this._listViewPos) + width  -
       Math.abs(this._rightCornerPos) - this.state.rightMargin - cornerWidth;
     return val * unit;
  }

  render() {
    const { images } = this.state;
    let needList = images && images.length !== 0;
    return (
      <View
        style={styles.container}
        onLayout={({ nativeEvent }) => {
          this.setState({
            layoutWidth: nativeEvent.layout.width
          });
        }}
      >
      {
        !needList ? <View style={{flex:1,height:50,backgroundColor:'rgba(0, 0, 0, 0.7)'}} /> :
        <View style={styles.container}>
            <View style={{flex:1,height:50,flexDirection:'column',backgroundColor:'black'}} >
                    <ListView
                        ref = "imagesListView"
                        renderHeader = {() => {
                          return (
                            <View style={{width:this.state.leftMargin,height:50,backgroundColor:'black'}} />
                          )}}
                        renderFooter = {() => {
                          return (
                            <View style={{width:this.state.rightMargin,height:50,backgroundColor:'black'}} />
                          )}}
                        automaticallyAdjustContentInsets = {false}
                        showsHorizontalScrollIndicator = {false}
                        horizontal = {true}
                        dataSource = {this.state.imageList.cloneWithRows(images)}
                        renderRow = {this._renderRow.bind(this)}
                        onScroll = {this._onScroll.bind(this)}
                    />

            </View>
            <View style={styles.corners}>
               {this.renderLeftSection()}
               {this.renderRightSection()}
            </View>
          </View>
        }
      </View>
    );
  }
}
